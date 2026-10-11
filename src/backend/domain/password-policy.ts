/**
 * What a staff or owner password must be. Length beats complexity rules
 * (NIST SP 800-63B): a long phrase is stronger and easier to remember than
 * "P@ssw0rd!". So: at least 12 characters, not the email, not the password
 * it replaces, and not one of the passwords every attacker tries first.
 */
export const ADMIN_MIN_PASSWORD = 12;

const COMMON = new Set([
  "password1234",
  "123456789012",
  "qwertyuiopas",
  "calanthe1234",
  "calanthe2026",
  "abudhabi2026",
  "iloveyou1234",
  "welcome12345",
  "admin1234567",
]);

export type PasswordProblem = { message: string; code: string };

export function passwordProblem(
  password: string,
  context: { email?: string; previous?: string },
): PasswordProblem | null {
  if (password.length < ADMIN_MIN_PASSWORD) {
    return { message: `Use at least ${ADMIN_MIN_PASSWORD} characters — a short phrase works well.`, code: "password.tooShort" };
  }
  if (password.length > 200) return { message: "That password is too long.", code: "password.tooLong" };
  const lower = password.toLowerCase();
  if (context.email && (lower === context.email.toLowerCase() || lower.includes(context.email.split("@")[0]!.toLowerCase()) && context.email.split("@")[0]!.length >= 4)) {
    return { message: "Don't use your email address in your password.", code: "password.containsEmail" };
  }
  if (context.previous && password === context.previous) {
    return { message: "Choose a password different from the current one.", code: "password.same" };
  }
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) {
    return { message: "That password is too easy to guess.", code: "password.common" };
  }
  return null;
}
