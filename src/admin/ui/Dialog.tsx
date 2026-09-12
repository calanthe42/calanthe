"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@admin/i18n/client";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

/**
 * Dialogs, built on the browser's own <dialog> element.
 *
 * WHY NATIVE. showModal() puts the dialog in the top layer: no ancestor can
 * clip it, re-anchor it or stack above it. The previous admin rendered its
 * delete confirmation inside a sticky save bar whose backdrop-filter made that
 * bar the containing block — on a phone the dialog opened off-screen and a
 * product could not be deleted. That whole class of bug cannot happen here.
 * The browser also traps focus, makes the page behind inert, closes on Escape
 * and returns focus to the button that opened it.
 */

type Variant = "modal" | "drawer" | "sheet";
type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, string> = {
  sm: "w-[min(26rem,calc(100vw-2rem))]",
  md: "w-[min(34rem,calc(100vw-2rem))]",
  lg: "w-[min(58rem,calc(100vw-2rem))]",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "modal",
  size = "md",
  dismissible = true,
  hideHeader = false,
  role,
  className,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: Variant;
  size?: Size;
  /** False while an action is running: it must not be dismissed mid-request. */
  dismissible?: boolean;
  /** For drawers that draw their own header; the title stays for screen readers. */
  hideHeader?: boolean;
  role?: "dialog" | "alertdialog";
  className?: string;
  bodyClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const isOpen = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const { t } = useI18n();

  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      isOpen.current = true;
      /* React's autoFocus runs before showModal, so it is honoured here. */
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  /* A dialog removed while open (a picker whose parent unmounts it) never
     fires its native close, so focus is returned to the opener here. */
  useEffect(
    () => () => {
      const target = opener.current;
      if (isOpen.current && target?.isConnected) requestAnimationFrame(() => target.focus());
    },
    [],
  );

  /* The page behind must not scroll under a thumb while a dialog is open. */
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      role={role}
      data-variant={variant}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissibleRef.current) onCloseRef.current();
      }}
      onClose={() => {
        isOpen.current = false;
        onCloseRef.current();
      }}
      onClick={(event) => {
        /* A click on the backdrop reports the dialog itself as its target, at
           a point outside the dialog's box. */
        if (event.target !== event.currentTarget || !dismissibleRef.current) return;
        const box = event.currentTarget.getBoundingClientRect();
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        if (!inside) onCloseRef.current();
      }}
      className={cn(
        "p-0 text-ink open:flex open:flex-col",
        variant === "modal" &&
          cn("m-auto max-h-[calc(100svh-2rem)] rounded-md border border-line bg-raised shadow-raised", SIZE[size]),
        variant === "sheet" &&
          cn(
            "mx-0 mb-0 mt-auto max-h-[92svh] w-full max-w-none rounded-t-md border border-line bg-raised shadow-raised sm:m-auto sm:max-h-[calc(100svh-2rem)] sm:rounded-md",
            size === "lg" ? "sm:w-[min(58rem,calc(100vw-2rem))]" : "sm:w-[min(34rem,calc(100vw-2rem))]",
          ),
        variant === "drawer" &&
          "m-0 h-svh max-h-none w-[min(19rem,88vw)] border-0 border-e border-line bg-nav text-nav-ink shadow-raised",
        className,
      )}
    >
      {open ? (
        <>
          {hideHeader ? (
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
          ) : (
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-3">
              <div className="min-w-0 py-2.5">
                <h2 id={titleId} className="text-base font-semibold leading-snug text-ink">
                  {title}
                </h2>
                {description ? (
                  <div id={descriptionId} className="mt-1 text-sm leading-relaxed text-ink-3">
                    {description}
                  </div>
                ) : null}
              </div>
              {dismissible ? (
                <IconButton label={t("common.close")} icon="close" onClick={() => onClose()} className="-me-2" />
              ) : null}
            </div>
          )}
          <div className={cn("min-h-0 flex-1 overflow-y-auto", !hideHeader && "px-5 py-4", bodyClassName)}>
            {hideHeader && description ? (
              <p id={descriptionId} className="sr-only">
                {description}
              </p>
            ) : null}
            {children}
          </div>
          {footer ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
              {footer}
            </div>
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}

/**
 * "Are you sure?" — for anything destructive or hard to undo.
 *
 * States the consequence in plain words, starts focus on the SAFE choice, and
 * cannot be dismissed while the action is running.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  pending?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={body}
      size="sm"
      role="alertdialog"
      dismissible={!pending}
      bodyClassName="hidden"
      footer={
        <>
          <Button data-autofocus onClick={onClose} disabled={pending} className="max-sm:flex-1">
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "dangerSolid" : "primary"}
            onClick={onConfirm}
            loading={pending}
            loadingText={t("common.working")}
            className="max-sm:flex-1"
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
