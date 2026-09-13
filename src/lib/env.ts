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

  /* --- Media storage (required in production) ---
     Server-side only. Vercel injects this when a Blob store is connected.
     Absent locally = uploads fall back to ./uploads (see
     backend/payload/storage.ts), which is development-only. */
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
   - BLOB_READ_WRITE_TOKEN is a hard requirement. Without it, uploads land on
     Vercel's ephemeral filesystem and are lost on the next deploy, so the
     server refuses to boot (backend/payload/storage.ts enforces the same).
   - Sentry (error tracking) and Upstash (rate limiting) are OPTIONAL.
     Nothing depends on them yet, and refusing to boot without them took the
     whole production site down. A missing value is logged, never fatal.
     Whatever first depends on Redis must require it at that point
     (lib/redis.ts returns null without credentials; callers fail closed).
   (`next build` also runs with NODE_ENV=production; the build phase makes no
   network calls, so it is exempt.) */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (process.env.VERCEL_ENV === "production" && !isBuildPhase) {
  if (!parsed.data.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Missing required production environment variables: BLOB_READ_WRITE_TOKEN");
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
