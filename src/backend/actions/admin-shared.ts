import { FormInputError } from "@backend/domain/form-error";
import type { MediaOption } from "@backend/domain/media-option";
import type { Actor } from "@backend/activity/record";

/**
 * What every admin action file shares: the result shape, who is acting, and
 * turning a thrown error into a sentence.
 *
 * WHY A SEPARATE FILE. actions/admin.ts is a "use server" module, and such a
 * module may export nothing but async functions. These are a type and two
 * plain functions, so the moment a second action file (actions/quotes.ts)
 * needed them they had to live somewhere that is not one.
 *
 * MESSAGES. Every result carries an English `message` and, where one exists,
 * a `code` — a path into the admin dictionary — with its `vars`. The admin
 * shows the code in the reader's language and falls back to the message.
 */

export type ActionVars = Record<string, string | number>;

export type ActionResult =
  | { ok: true; message: string; code?: string; vars?: ActionVars; id?: number; media?: MediaOption }
  | { ok: false; message: string; code?: string; vars?: ActionVars };

export type Failure = Extract<ActionResult, { ok: false }>;

/** The signed-in person, in the shape the activity log stores. */
export function actorOf(user: unknown): Actor {
  const u = (user ?? {}) as { id?: number; email?: string; name?: string; role?: string };
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

type ValidationDetail = { message?: unknown; path?: unknown };

/** Turns anything thrown into a sentence a florist can act on. */
export function failure(
  error: unknown,
  fallback: string,
  fallbackCode: string,
  uniqueField?: "slug" | "code",
): Failure {
  if (error instanceof FormInputError) {
    return {
      ok: false,
      message: error.message,
      code: error.code ? `actions.validation.${error.code}` : undefined,
      vars: error.vars,
    };
  }

  const raw = error instanceof Error ? error.message : "";
  if (/not allowed|forbidden|unauthori[sz]ed/i.test(raw)) {
    return { ok: false, message: "You do not have permission to do that.", code: "actions.permission" };
  }

  const details = (error as { data?: { errors?: ValidationDetail[] } } | null)?.data?.errors;
  const first = Array.isArray(details) ? details[0] : undefined;
  const detail = typeof first?.message === "string" ? first.message : "";
  const combined = `${raw} ${detail} ${typeof first?.path === "string" ? first.path : ""}`;

  if (/unique|duplicate|already/i.test(combined)) {
    /* When the driver does not name the column, the caller says which
       field is the only unique one it could have tripped. */
    const field = (typeof first?.path === "string" && first.path) || uniqueField || "";
    /* A discount code somebody already uses. Checked before the web-address
       case, whose "duplicate key" test would otherwise claim it. */
    if (uniqueField === "code" || /^code$/i.test(field)) {
      return {
        ok: false,
        message: "That code is already in use. Choose a different one.",
        code: "actions.discount.codeTaken",
      };
    }
    if (/slug/i.test(field) || /slug/i.test(combined) || /duplicate key/i.test(raw)) {
      return {
        ok: false,
        message: "That web address is already in use. Choose a different one.",
        code: "actions.slugTaken",
      };
    }
    /* A photo whose file name is already in the library. Payload does not
       rename on collision with remote storage; the owner has to. */
    if (/filename/i.test(field)) {
      return {
        ok: false,
        message: "A photo with that file name is already in the library. Rename the file and upload it again.",
        code: "actions.fileNameTaken",
      };
    }
    /* Any other unique field: still a sentence, never "Value must be unique". */
    return { ok: false, message: "That value is already in use. Choose a different one.", code: "actions.valueTaken" };
  }
  /* Validation errors thrown by the collections' hooks are already written
     for people, in English. Anything long or multi-line is a stack, never
     shown. */
  if (detail && detail.length < 200) return { ok: false, message: detail };
  if (raw && raw.length < 300 && !raw.includes("\n")) return { ok: false, message: raw };
  return { ok: false, message: fallback, code: fallbackCode };
}
