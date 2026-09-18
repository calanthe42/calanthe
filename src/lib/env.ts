import { z } from "zod";

/**
 * Environment schema — validated once at boot (see instrumentation.ts
 * and payload.config.ts). Fails fast with a readable message listing
 * every missing/invalid variable. Secrets live ONLY in env.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /* --- Required for the backend to boot --- */
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required (Neon Postgres connection string)")
    .refine((s) => s.startsWith("postgres"), {
      message: "DATABASE_URL must be a postgres:// connection string",
    }),
  PAYLOAD_SECRET: z.string().min(32, "PAYLOAD_SECRET must be at least 32 characters"),

  /* --- Public --- */
  NEXT_PUBLIC_SERVER_URL: z.string().url().default("http://localhost:3000"),

  /* --- Observability / infra (optional; a warning is logged in production) --- */
  SENTRY_DSN: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  /* --- Media storage (one of these is required in production) ---
     Server-side only. Vercel sets BLOB_STORE_ID when a Blob store is connected;
     that connection authenticates by OIDC and issues no long-lived token, so
     the store id is the credential. BLOB_READ_WRITE_TOKEN remains for hosts
     outside Vercel. With neither, uploads fall back to ./uploads (see
     backend/payload/storage.ts), which is development-only. */
  BLOB_STORE_ID: z.string().min(1).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${issues}\n` +
      "Copy .env.example to .env.local and fill in the values (see docs/RUNBOOK.md).",
  );
}

/* Production RUNTIME.
   - DATABASE_URL and PAYLOAD_SECRET are hard requirements, enforced by the
     schema above in every environment.
   - Blob storage is a hard requirement, satisfied by EITHER an OIDC connection
     (BLOB_STORE_ID, what Vercel sets today) or a legacy BLOB_READ_WRITE_TOKEN
     for a host outside Vercel. With neither, uploads land on Vercel's ephemeral
     filesystem and are lost on the next deploy, so the server refuses to boot
     (backend/payload/storage.ts enforces the same rule and explains it).
   - Sentry (error tracking) and Upstash (rate limiting) are OPTIONAL.
     Nothing depends on them yet, and refusing to boot without them took the
     whole production site down. A missing value is logged, never fatal.
     Whatever first depends on Redis must require it at that point
     (lib/redis.ts returns null without credentials; callers fail closed).
   (`next build` also runs with NODE_ENV=production; the build phase makes no
   network calls, so it is exempt.) */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (process.env.VERCEL_ENV === "production" && !isBuildPhase) {
  if (!parsed.data.BLOB_STORE_ID && !parsed.data.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Missing production media storage: connect a Vercel Blob store (which sets " +
        "BLOB_STORE_ID and authenticates by OIDC), or set BLOB_READ_WRITE_TOKEN " +
        "when running outside Vercel.",
    );
  }
  const unset = (
    ["SENTRY_DSN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const
  ).filter((k) => !parsed.data[k]);
  if (unset.length > 0) {
    console.warn(
      `[env] Optional production services are not configured: ${unset.join(", ")}. ` +
        "The site runs normally; error tracking (Sentry) and rate limiting (Upstash) " +
        "stay disabled until these are set.",
    );
  }
}

export const env = parsed.data;
