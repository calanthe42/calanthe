"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@admin/i18n/client";
import { IconButton } from "./IconButton";
import { Icon } from "./icons";

/**
 * One toast system for the whole admin.
 *
 * Success is announced politely and fades after five seconds (hovering or
 * focusing it pauses the clock, so it can be read). Errors are announced
 * immediately and stay until dismissed — an error that disappears on its own
 * is an error the owner never saw.
 *
 * The live regions are always in the page, empty until needed, because a
 * region inserted at the same moment as its message is often not announced.
 */

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; message: string };
type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current;
    nextId.current += 1;
    /* Four at most: a burst of saves should not wallpaper the screen. */
    setToasts((list) => [...list.slice(-3), { id, tone, message }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  const polite = toasts.filter((toast) => toast.tone !== "error");
  const urgent = toasts.filter((toast) => toast.tone === "error");

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 p-3 sm:items-end sm:p-5">
        <div role="alert" aria-live="assertive" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {urgent.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
        <div role="status" aria-live="polite" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {polite.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (toast.tone === "error" || paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast, paused, onDismiss]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-line bg-raised py-2 pe-2 ps-4 text-sm text-ink shadow-raised"
    >
      <Icon
        name={toast.tone === "success" ? "checkCircle" : toast.tone === "error" ? "alert" : "info"}
        className={cn(
          "mt-2.5 h-5 w-5",
          toast.tone === "success" && "text-success",
          toast.tone === "error" && "text-danger",
          toast.tone === "info" && "text-ink-3",
        )}
      />
      <p className="min-w-0 flex-1 py-2.5 leading-relaxed">{toast.message}</p>
      <IconButton label={t("common.dismiss")} icon="close" onClick={() => onDismiss(toast.id)} />
    </div>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider (the admin root layout).");
  return api;
}
