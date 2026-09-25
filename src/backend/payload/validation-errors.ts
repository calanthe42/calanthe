/**
 * Which field Payload actually rejected.
 *
 * WHY THIS EXISTS. Registration used to decide "was this a duplicate?" by
 * testing the error MESSAGE against /duplicate|unique|already/. Payload uses
 * none of those words. It throws a ValidationError saying
 *
 *     The following field is invalid: email
 *
 * and puts the useful part in `data.errors[]`:
 *
 *     { message: "Value must be unique", path: "phone" }
 *
 * So the test never matched, every collision fell through to a generic
 * "we could not create that account just now", and the customer was told to
 * retry something that could never succeed. That is what took registration
 * down on production on 2026-09-25 — twice, silently, with no account and no
 * email to show for it.
 *
 * Reading `path` is the reliable answer. The top-level message is read too
 * and merged, because it has been observed naming `email` for a collision
 * that `data.errors` attributed elsewhere, and a fix that depends on one of
 * two disagreeing sources is not a fix.
 */

type PayloadValidationError = {
  data?: { errors?: { path?: string; message?: string }[] };
};

/** Every field name the error blames, from both places Payload puts them. */
export function collidingFields(error: unknown): string[] {
  const fields = new Set<string>();

  const data = (error as PayloadValidationError)?.data;
  for (const e of data?.errors ?? []) {
    if (e?.path) fields.add(String(e.path));
  }

  const message = error instanceof Error ? error.message : "";
  const named = /following field is invalid:\s*([a-zA-Z0-9_]+)/.exec(message);
  if (named) fields.add(named[1]);

  return [...fields];
}

/** True when the error is a uniqueness collision on the named field. */
export function isUniqueCollision(error: unknown, field: string): boolean {
  return collidingFields(error).includes(field);
}
