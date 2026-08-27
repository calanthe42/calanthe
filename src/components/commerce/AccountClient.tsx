"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { fieldClasses } from "@/components/ui/form-classes";
import { Monogram } from "@/components/ui/Monogram";
import { clearAuth, readAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useToast } from "@/lib/toast";
import {
  formatAed,
  mockOrders,
  orderStatusLabels,
  type Order,
  type OrderStatus,
} from "@/lib/data";

const TABS = ["Orders", "Addresses", "Reminders", "Profile"] as const;
type Tab = (typeof TABS)[number];

const statusTone: Record<OrderStatus, string> = {
  preparing: "bg-cream text-olive border-hairline",
  "out-for-delivery": "bg-burnt-orange text-cream border-burnt-orange",
  delivered: "bg-olive text-cream border-olive",
};

const TIMELINE: readonly { status: OrderStatus; label: string }[] = [
  { status: "preparing", label: "Being arranged in the atelier" },
  { status: "out-for-delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
];

function statusIndex(status: OrderStatus): number {
  return TIMELINE.findIndex((t) => t.status === status);
}

function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const reached = statusIndex(order.status);

  return (
    <li className="rounded-sm border border-hairline">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <p className="font-display text-lg text-olive">{order.number}</p>
          <p className="text-sm text-sage">{order.placedOn}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "rounded-sm border px-3 py-1 font-brand text-[0.625rem] font-medium uppercase tracking-brand",
              statusTone[order.status],
            )}
          >
            {orderStatusLabels[order.status]}
          </span>
          <span className="text-sm text-olive">{formatAed(order.totalAed)}</span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_BLOOM }}
            className="overflow-hidden"
          >
            <div className="border-t border-hairline px-5 py-5">
              {/* Vertical monogram-dot timeline */}
              <ol className="relative flex flex-col gap-5 pl-7">
                <span
                  aria-hidden
                  className="absolute bottom-2 left-[7px] top-2 w-px bg-hairline"
                />
                {TIMELINE.map((step, i) => {
                  const done = i <= reached;
                  return (
                    <li key={step.status} className="relative flex items-center gap-3">
                      <span className="absolute -left-7 flex h-[15px] w-[15px] items-center justify-center bg-canvas">
                        <Monogram
                          className={cn(
                            "w-full",
                            done ? "text-burnt-orange" : "text-hairline",
                          )}
                        />
                      </span>
                      <span className={cn("text-sm", done ? "text-olive" : "text-sage")}>
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <ul className="mt-6 flex flex-col gap-2 border-t border-hairline pt-4">
                {order.items.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="text-olive">
                      {item.name} · {item.size} × {item.qty}
                      {item.addons.length > 0 && (
                        <span className="text-sage"> · {item.addons.join(" · ")}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-sage">{formatAed(item.priceAed)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-sage">Delivered to: {order.deliverTo}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

type Reminder = { name: string; occasion: string; date: string };

function Reminders() {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("calanthe-reminders-v1");
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setReminders(
            parsed.filter(
              (r): r is Reminder =>
                typeof r === "object" &&
                r !== null &&
                typeof (r as Reminder).name === "string" &&
                typeof (r as Reminder).occasion === "string" &&
                typeof (r as Reminder).date === "string",
            ),
          );
        }
      }
    } catch {
      /* start empty */
    }
  }, []);

  function save(next: Reminder[]) {
    setReminders(next);
    try {
      localStorage.setItem("calanthe-reminders-v1", JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }

  const field = fieldClasses;

  return (
    <div>
      <p className="max-w-md text-sm leading-relaxed text-sage">
        We&apos;ll remind you a few days ahead, so the flowers always arrive on time.
        (Reminders send once the backend arrives.)
      </p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Who is it for?"
          className={field}
        />
        <input
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          placeholder="Occasion"
          className={field}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={field}
        />
      </div>
      <Button
        variant="secondary"
        className="mt-4"
        onClick={() => {
          if (!name.trim() || !occasion.trim() || !date) {
            toast("Fill in all three fields to save a reminder");
            return;
          }
          save([...reminders, { name, occasion, date }]);
          setName("");
          setOccasion("");
          setDate("");
          toast("Reminder saved");
        }}
      >
        Add Reminder
      </Button>

      {reminders.length > 0 && (
        <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
          {reminders.map((r, i) => (
            <li
              key={`${r.name}-${r.date}`}
              className="flex items-center justify-between gap-3 py-4"
            >
              <div>
                <p className="text-base text-olive">
                  {r.name} — {r.occasion}
                </p>
                <p className="text-sm text-sage">
                  {new Date(r.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => save(reminders.filter((_, j) => j !== i))}
                className="min-h-11 px-2 text-sm text-sage underline-offset-4 hover:text-olive hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AccountClient() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("Orders");
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(readAuth() !== null);
  }, []);

  if (authed === null) return <div className="min-h-[50svh]" />;

  if (!authed) {
    return (
      <div className="flex min-h-[50svh] flex-col items-center justify-center gap-6 text-center">
        <Monogram className="w-14 text-sage" />
        <p className="font-display text-2xl font-light italic text-olive">
          Sign in to see your atelier account.
        </p>
        <Link href="/login" className={buttonClasses("primary")}>
          Sign In
        </Link>
      </div>
    );
  }

  const field = fieldClasses;

  return (
    <div>
      {/* Quiet text tabs */}
      <div className="no-scrollbar flex gap-6 overflow-x-auto border-b border-hairline">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "min-h-11 whitespace-nowrap pb-3 font-brand text-[0.6875rem] font-medium uppercase tracking-brand transition-colors duration-200 ease-bloom",
              tab === t
                ? "border-b border-burnt-orange text-olive"
                : "text-sage hover:text-olive",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pt-8">
        {tab === "Orders" && (
          <ul className="flex flex-col gap-4">
            {mockOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </ul>
        )}

        {tab === "Addresses" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { label: "Home", lines: "Villa 14, Street 8b, Jumeirah 1, Dubai" },
              { label: "Office", lines: "Floor 22, Al Reem Island, Abu Dhabi" },
            ].map((addr) => (
              <div key={addr.label} className="rounded-sm border border-hairline p-5">
                <Eyebrow>{addr.label}</Eyebrow>
                <p className="mt-2 text-base leading-relaxed text-olive">{addr.lines}</p>
              </div>
            ))}
            <button
              type="button"
              onClick={() => toast("Address book opens with the backend phase")}
              className="flex min-h-24 items-center justify-center rounded-sm border border-dashed border-hairline text-sm text-sage transition-colors duration-200 ease-bloom hover:border-sage hover:text-olive"
            >
              + Add address
            </button>
          </div>
        )}

        {tab === "Reminders" && <Reminders />}

        {tab === "Profile" && (
          <div className="max-w-md">
            <div className="grid grid-cols-1 gap-4">
              <input className={field} defaultValue="Calanthe Guest" aria-label="Name" />
              <input
                className={field}
                defaultValue="+971 50 123 4567"
                aria-label="Phone"
              />
              <input
                className={field}
                placeholder="Email (optional)"
                aria-label="Email"
              />
            </div>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => toast("Saved — profile syncs with the backend phase")}
            >
              Save Changes
            </Button>
            <button
              type="button"
              onClick={() => {
                clearAuth();
                setAuthed(false);
                toast("Signed out");
              }}
              className="ml-4 min-h-11 text-sm text-sage underline-offset-4 hover:text-olive hover:underline"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
