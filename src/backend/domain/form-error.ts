/**
 * A mistake in something a person typed, worded for that person.
 *
 * Server actions catch this and show its message verbatim. Anything else that
 * goes wrong is translated or replaced with a generic sentence — a stack trace
 * or a database constraint name is never something to show a florist.
 */
export class FormInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormInputError";
  }
}
