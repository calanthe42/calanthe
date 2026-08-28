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

  /* --- Observability / infra (required in production) --- */
  SENTRY_DSN: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
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

/* Production RUNTIME additionally requires the infra vars — fail
   closed. (`next build` also runs with NODE_ENV=production; the build
   phase itself makes no network calls, so it is exempt — the server
   still refuses to BOOT without these via instrumentation.ts.) */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (parsed.data.NODE_ENV === "production" && !isBuildPhase) {
  const missing = (
    ["SENTRY_DSN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const
  ).filter((k) => !parsed.data[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`,
    );
  }
}

export const env = parsed.data;
