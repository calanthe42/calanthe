/**
 * The Resend adapter.
 *
 * Deliberately behind `EmailProvider` so the rest of the app never imports
 * Resend directly: tests use a recording provider and never touch the
 * network, and swapping vendor is one file rather than a search across
 * templates.
 *
 * Uses Resend's REST API over `fetch` rather than the SDK. The SDK adds a
 * dependency to do one POST, and what matters here — the message id, which
 * is the only thing that can later prove a message was delivered — comes
 * back either way.
 */
import type { EmailProvider, SendOutcome, SendRequest } from "./types";

const ENDPOINT = "https://api.resend.com/emails";

export function resendProvider(apiKey: string): EmailProvider {
  return {
    name: "resend",
    async send(request: SendRequest, from: string, replyTo?: string): Promise<SendOutcome> {
      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [request.to],
            subject: request.rendered.subject,
            html: request.rendered.html,
            /* Never HTML alone. A text part is what spam filters read and
               what a watch renders. */
            text: request.rendered.text,
            ...(replyTo ? { reply_to: replyTo } : {}),
            tags: [{ name: "type", value: request.type }],
          }),
        });

        const body = (await response.json().catch(() => null)) as
          | { id?: string; message?: string; name?: string }
          | null;

        if (!response.ok) {
          return {
            status: "failed",
            error: `resend ${response.status}: ${body?.message ?? body?.name ?? "unknown error"}`,
          };
        }
        if (!body?.id) {
          return { status: "failed", error: "resend accepted the request but returned no id" };
        }
        return { status: "sent", providerId: body.id };
      } catch (error) {
        /* A network failure is a failed email, never a thrown one — the
           caller is usually finishing an order. */
        return {
          status: "failed",
          error: error instanceof Error ? error.message : "unknown transport error",
        };
      }
    },
  };
}

/** Records instead of sending. Used by tests and by any run with no API key. */
export function recordingProvider(sent: SendRequest[] = []): EmailProvider & {
  readonly sent: SendRequest[];
} {
  return {
    name: "recording",
    sent,
    async send(request: SendRequest): Promise<SendOutcome> {
      sent.push(request);
      return { status: "sent", providerId: `recorded-${sent.length}` };
    },
  };
}
