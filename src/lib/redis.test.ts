import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Preview and Production share one Upstash database. Without a namespace they
 * also share rate-limit buckets and idempotency keys, which means a preview
 * deployment can lock a real customer out of signing in, and a webhook id
 * replayed in preview can mark a production event already handled.
 *
 * lib/redis imports lib/env, which validates process.env on first import, so
 * each case supplies a valid baseline and re-imports the module fresh — the
 * same approach env.test.ts uses.
 */
const env = process.env as Record<string, string | undefined>;
const saved = { ...env };

const BASELINE = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  PAYLOAD_SECRET: "x".repeat(32),
  /* env.ts refuses to boot a production runtime with no blob credentials —
     uploads would land on Vercel's ephemeral filesystem and be lost on the
     next deploy. Supplied so these cases exercise the namespace rather than
     that guard. */
  BLOB_STORE_ID: "store_test",
};

async function importWith(vercelEnv: string | undefined) {
  vi.resetModules();
  Object.assign(env, BASELINE);
  if (vercelEnv === undefined) delete env.VERCEL_ENV;
  else env.VERCEL_ENV = vercelEnv;
  /* No Upstash credentials on purpose: the namespace must be decided without
     a live connection, and `redis` is null here. */
  delete env.UPSTASH_REDIS_REST_URL;
  delete env.UPSTASH_REDIS_REST_TOKEN;
  return import("@/lib/redis");
}

afterEach(() => {
  for (const k of Object.keys(env)) if (!(k in saved)) delete env[k];
  Object.assign(env, saved);
  vi.resetModules();
});

describe("redis key namespace", () => {
  it("namespaces by the deployment environment", async () => {
    const { keyPrefix, KEY_ENV } = await importWith("production");
    expect(KEY_ENV).toBe("production");
    expect(keyPrefix("rl:customer-login")).toBe("production:rl:customer-login");
  });

  it("gives preview a different namespace from production", async () => {
    const prod = (await importWith("production")).keyPrefix("rl:customer-login");
    const prev = (await importWith("preview")).keyPrefix("rl:customer-login");
    expect(prev).not.toBe(prod);
    expect(prev.startsWith("preview:")).toBe(true);
  });

  it("gives a machine with no VERCEL_ENV its own namespace", async () => {
    const { KEY_ENV, keyPrefix } = await importWith(undefined);
    expect(KEY_ENV).toBe("local");
    expect(keyPrefix("rl:x")).toBe("local:rl:x");
  });

  it("never lets two environments collide on the same bucket", async () => {
    const envs = ["production", "preview", "development", undefined];
    const keys: string[] = [];
    for (const e of envs) keys.push((await importWith(e)).keyPrefix("rl:register"));
    expect(new Set(keys).size).toBe(envs.length);
  });

  it("returns no limiter without credentials, so callers must fail closed", async () => {
    const { rateLimit } = await importWith("production");
    expect(rateLimit("customer-login", 5, "1 m")).toBeNull();
  });
});
