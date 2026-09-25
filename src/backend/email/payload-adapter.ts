/**
 * Payload's own emails, sent and logged the same way as ours.
 *
 * Payload sends verification and password-reset mail itself. Left alone it
 * uses whatever transport is configured — and with none, it writes the link
 * to the server console and reports success, which is why a customer could
 * register on the live site and never hear anything while the logs looked
 * fine.
 *
 * This adapter routes those messages through `sendEmail`, so they obey the
 * same rules as every other email: the non-production allowlist applies, a
 * failure is recorded rather than thrown, and every attempt leaves a row
 * with the provider's id in it.
 */
import type { EmailAdapter, SendEmailOptions } from "payload";
import { env } from "@/lib/env";
import { sendEmail } from "./send";
import type { EmailType } from "./types";

/** Payload does not say what a message is for, so infer it from the subject. */
function classify(subject: string): EmailType {
  const s = subject.toLowerCase();
  if (s.includes("reset")) return "password-reset";
  return "verify-address";
}

function firstAddress(to: SendEmailOptions["to"]): string {
  if (typeof to === "string") return to;
  if (Array.isArray(to)) {
    const head = to[0];
    return typeof head === "string" ? head : (head?.address ?? "");
  }
  return to?.address ?? "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|tr|div|h1|h2)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&middot;/g, "·")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const calantheEmailAdapter: EmailAdapter = ({ payload }) => ({
  name: "calanthe",
  defaultFromAddress: env.EMAIL_FROM ?? "orders@calanthe.ae",
  defaultFromName: "Calanthe",
  async sendEmail(message: SendEmailOptions) {
    const to = firstAddress(message.to);
    const subject = message.subject ?? "Calanthe";
    const html = typeof message.html === "string" ? message.html : "";
    const text =
      typeof message.text === "string" && message.text.trim().length > 0
        ? message.text
        : stripHtml(html);

    const outcome = await sendEmail(payload, {
      to,
      type: classify(subject),
      rendered: { subject, html, text },
    });

    /* Payload treats a throw as a failed operation, and a failed
       verification email must not undo a registration. The outcome is
       already recorded in the log. */
    return outcome;
  },
});
