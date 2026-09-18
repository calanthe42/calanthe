"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@admin/i18n/client";
import { Button } from "./Button";
import { ConfirmDialog } from "./Dialog";
import { Icon } from "./icons";
import { useAction, type ActionOutcome } from "./useAction";

/**
 * A form bound to a server action — the whole save cycle in one place.
 *
 * A save that silently does nothing is the single most common way an admin
 * loses a business owner's trust: she cannot tell whether the change took, so
 * she does it again, or assumes it worked. So every form here says, at all
 * times, one of: unsaved changes · saving · saved · couldn't save — and a
 * failed save keeps everything she typed.
 *
 * Page forms also guard against leaving with unsaved changes: in-app links
 * ask first, and reloading or closing the tab triggers the browser's own
 * warning. (The browser Back button cannot be intercepted reliably; it gets
 * the browser's warning where the browser offers one.)
 */

const MarkDirtyContext = createContext<() => void>(() => undefined);

/** For controls that change the form without firing input events (a photo gallery). */
export function useMarkDirty(): () => void {
  return useContext(MarkDirtyContext);
}

export function ActionForm({
  action,
  children,
  submitLabel,
  variant = "page",
  secondary,
  destructive,
  readOnly = false,
  onSuccess,
  redirectTo,
  guardUnsaved,
}: {
  action: (form: FormData) => Promise<ActionOutcome>;
  children: ReactNode;
  submitLabel?: string;
  /** "page": a sticky save bar along the bottom. "card": a footer inside a side column. */
  variant?: "page" | "card";
  secondary?: ReactNode;
  destructive?: ReactNode;
  readOnly?: boolean;
  onSuccess?: (result: ActionOutcome) => void;
  redirectTo?: string;
  guardUnsaved?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const { state, error, run } = useAction();
  const markDirty = useCallback(() => setDirty(true), []);
  const guard = (guardUnsaved ?? variant === "page") && !readOnly && dirty && state !== "saving";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const data = new FormData(event.currentTarget);
    void run(() => action(data), {
      onSuccess: (result) => {
        setDirty(false);
        onSuccess?.(result);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      },
    });
  }

  const status =
    state === "saving"
      ? t("common.saving")
      : state === "saved"
        ? t("common.saved")
        : state === "failed"
          ? t("common.couldNotSave")
          : dirty
            ? t("common.unsavedChanges")
            : "";

  return (
    <MarkDirtyContext.Provider value={markDirty}>
      <form onSubmit={onSubmit} onInput={markDirty} onChange={markDirty} noValidate aria-busy={state === "saving"} className="min-w-0">
        {readOnly ? (
          <fieldset disabled className="m-0 min-w-0 border-0 p-0">
            {children}
          </fieldset>
        ) : (
          children
        )}

        {state === "failed" && error ? (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger/[0.08] px-4 py-3 text-sm leading-relaxed text-ink"
          >
            <Icon name="alert" className="mt-0.5 h-4 w-4 text-danger" />
            {error}
          </div>
        ) : null}

        <div
          className={cn(
            variant === "page"
              ? "sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-page/90 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
              : "mt-4 rounded-md border border-line bg-surface px-4 py-3 shadow-card",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            {destructive}
            <p
              aria-live="polite"
              className={cn(
                "order-first flex min-h-5 w-full items-center gap-2 text-sm sm:order-none sm:me-auto sm:w-auto",
                state === "failed" ? "text-danger" : state === "saved" ? "text-success" : "text-ink-3",
                !status && "hidden sm:flex",
              )}
            >
              {dirty && state === "idle" ? <span aria-hidden className="h-2 w-2 rounded-full bg-warning" /> : null}
              {state === "saved" ? <Icon name="check" className="h-4 w-4" /> : null}
              {status}
            </p>
            {secondary}
            {readOnly ? null : (
              <Button
                type="submit"
                variant="primary"
                loading={state === "saving"}
                loadingText={t("common.saving")}
                className="max-sm:flex-1"
              >
                {submitLabel ?? t("common.saveChanges")}
              </Button>
            )}
          </div>
        </div>
      </form>

      <UnsavedChangesGuard active={guard} />
    </MarkDirtyContext.Provider>
  );
}

/**
 * Asks before leaving a page with unsaved changes.
 *
 * Clicks on same-origin links are caught in the capture phase — before Next's
 * Link handles them — and held until the person chooses. Reload and tab close
 * use the browser's own beforeunload prompt, the only one browsers allow.
 */
export function UnsavedChangesGuard({ active }: { active: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  return (
    <ConfirmDialog
      open={pendingHref !== null}
      onClose={() => setPendingHref(null)}
      onConfirm={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (href) router.push(href);
      }}
      title={t("common.leaveTitle")}
      body={t("common.leaveBody")}
      confirmLabel={t("common.leaveConfirm")}
      cancelLabel={t("common.stay")}
    />
  );
}
