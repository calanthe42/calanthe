"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useI18n } from "@admin/i18n/client";
import { Icon } from "@admin/ui/icons";
import { useToast } from "@admin/ui/Toast";
import { cn } from "@/lib/cn";
import type { AdminPulse, PulseItem } from "@backend/data/admin-pulse";

/**
 * THE BELL.
 *
 * An order or an enquiry arriving is the one event the shop must not miss,
 * and the owner is not sitting on the orders list waiting for it. So the
 * shell itself keeps watch: every half minute (and the moment the tab comes
 * back into view) it asks /admin/pulse what arrived since she last looked,
 * and if something did, three things happen at once — the badge on the bell
 * counts it, a soft chime plays, and the browser shows a notification, even
 * when the admin is in a background tab. Nothing here is optimistic; every
 * alert is something the server confirmed exists.
 *
 * "Last looked" lives in this browser (localStorage), so a second device
 * has its own memory and nobody's badge is cleared by somebody else. A first
 * visit starts the clock at now — the old orders are not news.
 *
 * Browser notifications need a permission the browser will only ask for in
 * response to a click, so the panel offers "Turn on alerts on this device"
 * until it has been granted; the badge and chime work regardless.
 *
 * ONE WATCHER, TWO BELLS. The bell shows in the desktop header and in the
 * phone bar, and both are in the DOM at once (one is merely hidden). If each
 * polled, every arrival would ring twice. So `PulseProvider`, mounted once
 * in the shell, does all the watching, and `PulseBell` only displays.
 */

const POLL_MS = 30_000;
const SEEN_KEY = "calanthe-admin-seen";

const readSeen = (): string | null => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};
const writeSeen = (iso: string) => {
  try {
    localStorage.setItem(SEEN_KEY, iso);
  } catch {
    /* Private mode: the badge simply starts over next visit. */
  }
};

/** Two soft sine notes, a fifth apart. Quiet, brief, no file to load. */
function chime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const at = ctx.currentTime;
    for (const [freq, start] of [
      [659.25, 0],
      [987.77, 0.16],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at + start);
      gain.gain.exponentialRampToValueAtTime(0.09, at + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + start + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at + start);
      osc.stop(at + start + 0.5);
    }
    window.setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* No audio on this device: the badge and the notification still say it. */
  }
}

type PulseState = {
  items: PulseItem[];
  unseen: number;
  permission: NotificationPermission | "unsupported";
  markSeen: () => void;
  turnOn: () => Promise<void>;
};

const PulseContext = createContext<PulseState | null>(null);

export function PulseProvider({ children }: { children: React.ReactNode }) {
  const { t, money, plural } = useI18n();
  const toast = useToast();
  const [items, setItems] = useState<PulseItem[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const seenRef = useRef<string | null>(null);
  const alertedRef = useRef<string | null>(null);

  const describe = useCallback(
    (item: PulseItem) =>
      item.kind === "order"
        ? t("pulse.newOrder", {
            number: item.title,
            amount: item.amountFils != null ? money(item.amountFils) : "",
          }).trim()
        : t("pulse.newEnquiry", { name: item.detail || item.title }),
    [t, money],
  );

  const poll = useCallback(async () => {
    const since = seenRef.current;
    try {
      const res = await fetch(`/admin/pulse?since=${encodeURIComponent(since ?? "")}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const pulse = (await res.json()) as AdminPulse;
      setItems(pulse.recent);
      setUnseen(pulse.fresh.length);
      /* Alert once per arrival: only what is newer than the last thing we
         already rang for. */
      const newest = pulse.fresh[0]?.at ?? null;
      const ring = pulse.fresh.filter(
        (item) => !alertedRef.current || item.at > alertedRef.current,
      );
      if (ring.length > 0) {
        alertedRef.current = newest;
        chime();
        const headline = describe(ring[0]!);
        toast.info(
          ring.length === 1
            ? headline
            : plural("pulse.arrived", ring.length, { first: headline }),
        );
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          document.visibilityState !== "visible"
        ) {
          try {
            new Notification(
              ring.length === 1
                ? headline
                : plural("pulse.arrived", ring.length, { first: headline }),
              {
                body: t("pulse.notificationBody"),
                tag: "calanthe-pulse",
              },
            );
          } catch {
            /* Some browsers refuse constructor notifications; the toast stands. */
          }
        }
      }
    } catch {
      /* Offline for a moment: try again next tick. */
    }
  }, [describe, t, plural, toast]);

  useEffect(() => {
    const stored = readSeen();
    /* First visit on this device: the clock starts now, so old orders are
       not announced as news. */
    const start = stored ?? new Date().toISOString();
    if (!stored) writeSeen(start);
    seenRef.current = start;
    alertedRef.current = start;
    if (typeof Notification !== "undefined") setPermission(Notification.permission);

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    seenRef.current = now;
    writeSeen(now);
    setUnseen(0);
  }, []);

  const turnOn = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success(t("pulse.turnedOn"));
  }, [toast, t]);

  return (
    <PulseContext.Provider value={{ items, unseen, permission, markSeen, turnOn }}>
      {children}
    </PulseContext.Provider>
  );
}

export function PulseBell({ compact = false }: { compact?: boolean }) {
  const { t, money, date, plural } = useI18n();
  const pulse = useContext(PulseContext);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const items = pulse?.items ?? [];
  const unseen = pulse?.unseen ?? 0;
  const permission = pulse?.permission ?? "unsupported";

  /* Close on Escape and on a click outside. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const markSeen = () => pulse?.markSeen();
  const turnOn = () => pulse?.turnOn();

  const label = unseen > 0 ? plural("pulse.unseen", unseen) : t("pulse.alerts");

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          compact && "h-11 w-11",
        )}
      >
        <Icon name="bell" className="h-5 w-5" />
        {unseen > 0 && (
          <span
            aria-hidden
            className="absolute end-1.5 top-1.5 min-w-[1.125rem] rounded-full bg-accent px-1 text-center text-[0.6875rem] font-semibold leading-[1.125rem] text-on-accent"
          >
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("pulse.alerts")}
          className="absolute end-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-md border border-line bg-raised shadow-raised"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-sm font-medium text-ink">{t("pulse.alerts")}</p>
            {unseen > 0 && (
              <button
                type="button"
                onClick={markSeen}
                className="min-h-11 text-xs text-ink-2 hover:text-ink"
              >
                {t("pulse.markSeen")}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm leading-relaxed text-ink-2">
              {t("pulse.nothingNew")}
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-14 items-start gap-3 px-4 py-3 transition-colors duration-150 hover:bg-hover"
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sunken text-ink-2"
                    >
                      <Icon
                        name={item.kind === "order" ? "bag" : "message"}
                        className="h-4 w-4"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {item.kind === "order"
                          ? t("pulse.order", { number: item.title })
                          : item.title}
                      </span>
                      <span className="block truncate text-xs text-ink-2">
                        {[
                          item.detail,
                          item.amountFils != null ? money(item.amountFils) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-3">
                      {date(item.at, "time")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {permission === "default" && (
            <div className="border-t border-line px-4 py-3">
              <button
                type="button"
                onClick={() => void turnOn()}
                className="min-h-11 text-sm text-ink underline-offset-4 hover:underline"
              >
                {t("pulse.turnOn")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
