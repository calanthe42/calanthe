"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@admin/i18n/client";
import type { Vars } from "@admin/i18n/translate";
import { useToast } from "./Toast";

/**
 * The one way a screen runs a server action: idle → saving → saved | failed.
 *
 * "Saved" and the success toast happen only AFTER the server has answered
 * ok. Nothing here is optimistic — the interface never claims a change it has
 * not been told succeeded. A thrown error (the network dropped, the server
 * restarted) is a failure with a plain message, never a silent nothing.
 *
 * Messages are shown in the reader's language: the action's `code` is looked
 * up in the dictionary, with its English `message` as the fallback.
 */

export type ActionOutcome = { ok: boolean; message: string; code?: string; vars?: Vars; id?: number };
export type ActionState = "idle" | "saving" | "saved" | "failed";

type RunOptions<R> = {
  onSuccess?: (result: R) => void;
  onFailure?: (result: R | null) => void;
  /** Skip the success toast, e.g. when the page already says so. */
  quiet?: boolean;
};

export function useAction() {
  const [state, setState] = useState<ActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const { t, resolve } = useI18n();
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  const run = useCallback(
    async <R extends ActionOutcome>(fn: () => Promise<R>, options: RunOptions<R> = {}) => {
      if (settle.current) clearTimeout(settle.current);
      setState("saving");
      setError(null);

      let result: R | null = null;
      try {
        result = await fn();
      } catch {
        result = null;
      }

      if (result?.ok) {
        setState("saved");
        if (!options.quiet) toast.success(resolve(result.code, result.vars, result.message));
        options.onSuccess?.(result);
        settle.current = setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 2500);
      } else {
        const message = result
          ? resolve(result.code, result.vars, result.message || t("common.couldNotSave"))
          : t("common.couldNotSave");
        setState("failed");
        setError(message);
        toast.error(message);
        options.onFailure?.(result);
      }
      return result;
    },
    [toast, t, resolve],
  );

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
  }, []);

  return { state, error, run, reset, pending: state === "saving" };
}
