/**
 * A mistake in something a person typed, worded for that person.
 *
 * Server actions catch this and show its message verbatim. Anything else that
 * goes wrong is translated or replaced with a generic sentence — a stack trace
 * or a database constraint name is never something to show a florist.
 *
 * `code` and `vars` let the admin show the same mistake in the reader's
 * language: the action looks the code up in its dictionary and falls back to
 * the English `message` when no translation exists. The domain stays free of
 * any knowledge of languages.
 */
export class FormInputError extends Error {
  readonly code?: string;
  readonly vars?: Record<string, string | number>;

  constructor(message: string, code?: string, vars?: Record<string, string | number>) {
    super(message);
    this.name = "FormInputError";
    this.code = code;
    this.vars = vars;
  }
}
