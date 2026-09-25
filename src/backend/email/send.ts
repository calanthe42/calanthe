/**
 * Sending an email, and writing down what happened.
 *
 * TWO RULES GOVERN THIS FILE.
 *
 * 1. A FAILED EMAIL NEVER FAILS THE THING THAT TRIGGERED IT. An order is the
 *    customer's; an email is our convenience. `sendEmail` therefore has no
 *    throwing path at all — every outcome, including "the provider is down"
 *    and "there is no provider", resolves to a logged row. A checkout that
 *    502s because Resend had a bad minute is a worse failure than a missing
 *    receipt.
 *
 * 2. NOTHING IS SENT BEFORE THE DATABASE HAS COMMITTED. An email that says
 *    "your order is confirmed" must never be able to arrive for an order
 *    that was rolled back. Callers invoke this AFTER the write, never inside
 *    a transaction — see `queueAfterCommit`.
 */
import type { Payload } from "payload";
import { env } from "@/lib/env";
import { decideRecipient } from "./allowlist";
import { resendProvider } from "./resend";
import type { EmailProvider, SendOutcome, SendRequest } from "./types";

let override: EmailProvider | null = null;

/** Tests inject a recording provider; nothing else should call this. */
export function setEmailProvider(provider: EmailProvider | null): void {
  override = provider;
}

export function currentProvider(): EmailProvider | null {
  if (override) return override;
  if (!env.RESEND_API_KEY) return null;
  return resendProvider(env.RESEND_API_KEY);
}

export function emailEnvironment(): string {
  return process.env.VERCEL_ENV ?? "local";
}

/**
 * Send one email and record the attempt. Never throws.
 *
 * The log row is written whatever the outcome — sent, failed, skipped for
 * want of a provider, or suppressed by the non-production allowlist —
 * because "no row" and "it failed" must never look the same when the owner
 * is trying to find out why a customer heard nothing.
 */
export async function sendEmail(
  payload: Payload,
  request: SendRequest,
  options: { resentFrom?: number | string } = {},
): Promise<SendOutcome> {
  const environment = emailEnvironment();
  let outcome: SendOutcome;

  try {
    const provider = currentProvider();
    const from = env.EMAIL_FROM;

    if (!provider || !from) {
      outcome = {
        status: "skipped",
        error: !provider
          ? "no RESEND_API_KEY — the app is running without an email provider"
          : "no EMAIL_FROM — nothing can be sent without a verified sender",
      };
    } else {
      const decision = decideRecipient(request.to, {
        vercelEnv: process.env.VERCEL_ENV,
        allowlist: env.EMAIL_ALLOWLIST,
      });
      outcome = decision.allowed
        ? await provider.send(request, from, env.EMAIL_REPLY_TO)
        : { status: "suppressed", error: decision.reason };
    }
  } catch (error) {
    /* Anything unforeseen is still just a failed email. */
    outcome = {
      status: "failed",
      error: error instanceof Error ? error.message : "unknown error while sending",
    };
  }

  try {
    await payload.create({
      collection: "email-log",
      overrideAccess: true,
      data: {
        to: request.to,
        type: request.type,
        status: outcome.status,
        subject: request.rendered.subject,
        environment,
        ...(outcome.providerId ? { providerId: outcome.providerId } : {}),
        ...(outcome.error ? { error: outcome.error.slice(0, 500) } : {}),
        ...(request.orderNumber ? { orderNumber: request.orderNumber } : {}),
        ...(request.orderId ? { order: request.orderId } : {}),
        ...(options.resentFrom ? { resentFrom: options.resentFrom } : {}),
      } as never,
    });
  } catch (error) {
    /* If even the log write fails, say so loudly and still do not throw —
       the caller is finishing someone's order. */
    payload.logger.error(
      `[email] ${request.type} to ${request.to} was ${outcome.status}, and the log row could not be written: ${
        error instanceof Error ? error.message : "unknown"
      }`,
    );
  }

  if (outcome.status === "failed") {
    payload.logger.error(`[email] ${request.type} to ${request.to} failed: ${outcome.error}`);
  }

  return outcome;
}

/**
 * Send several emails after the work that triggered them has committed.
 *
 * Runs them in sequence rather than in parallel so a provider rate limit
 * cannot turn one slow order into several failures, and awaits the lot so a
 * serverless function is never frozen mid-send — a fire-and-forget promise
 * on Vercel is a promise that may simply never run.
 */
export async function sendAfterCommit(
  payload: Payload,
  requests: readonly SendRequest[],
): Promise<SendOutcome[]> {
  const outcomes: SendOutcome[] = [];
  for (const request of requests) {
    outcomes.push(await sendEmail(payload, request));
  }
  return outcomes;
}
