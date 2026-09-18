import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Production boot rules for the environment.
 *
 * lib/env.ts validates process.env when it is first imported, so each case
 * sets the environment, clears the module cache and imports it fresh.
 */

const KEYS = [
  "NODE_ENV",
  "VERCEL_ENV",
  "NEXT_PHASE",
  "DATABASE_URL",
  "PAYLOAD_SECRET",
  "SENTRY_DSN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_STORE_ID",
] as const;

const env = process.env as Record<string, string | undefined>;
let saved: Record<string, string | undefined> = {};

const REQUIRED = {
  DATABASE_URL: "postgres://user:password@localhost:5432/calanthe",
  PAYLOAD_SECRET: "a".repeat(32),
};

const OPTIONAL = {
  SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
};

const BLOB = { BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test" };
const PRODUCTION = { NODE_ENV: "production", VERCEL_ENV: "production" };

function set(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) env[key] = value;
}

async function load() {
  vi.resetModules();
  return import("./env");
}

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, env[key]]));
  for (const key of KEYS) delete env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
  vi.restoreAllMocks();
});

describe("production boot", () => {
  it("boots without Sentry and Upstash, and warns once naming what is missing", async () => {
    set({ ...REQUIRED, ...BLOB, ...PRODUCTION });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(load()).resolves.toBeDefined();
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      "SENTRY_DSN, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN",
    );
  });

  it("does not warn when the optional services are configured", async () => {
    set({ ...REQUIRED, ...BLOB, ...OPTIONAL, ...PRODUCTION });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await load();
    expect(warn).not.toHaveBeenCalled();
  });

  it("still refuses to boot without persistent media storage, naming only that", async () => {
    set({ ...REQUIRED, ...PRODUCTION });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = await load().then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(String(error)).toContain("BLOB_STORE_ID");
    expect(String(error)).toContain("BLOB_READ_WRITE_TOKEN");
    expect(String(error)).not.toContain("SENTRY_DSN");
  });

  it("boots on an OIDC Blob connection, which issues no long-lived token", async () => {
    /* BLOB_STORE_ID with no token is what Vercel sets up today. */
    set({ ...REQUIRED, ...PRODUCTION, BLOB_STORE_ID: "store_2HiX9XW4ECpo" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(load()).resolves.toBeDefined();
  });

  it("still refuses to boot without DATABASE_URL", async () => {
    set({ PAYLOAD_SECRET: REQUIRED.PAYLOAD_SECRET, ...BLOB, ...PRODUCTION });
    await expect(load()).rejects.toThrow(/DATABASE_URL/);
  });

  it("still refuses to boot without PAYLOAD_SECRET", async () => {
    set({ DATABASE_URL: REQUIRED.DATABASE_URL, ...BLOB, ...PRODUCTION });
    await expect(load()).rejects.toThrow(/PAYLOAD_SECRET/);
  });
});

describe("outside production", () => {
  it("boots a preview deployment with no optional services and no Blob store, silently", async () => {
    set({ ...REQUIRED, NODE_ENV: "production", VERCEL_ENV: "preview" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(load()).resolves.toBeDefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("requires nothing extra during `next build`", async () => {
    set({ ...REQUIRED, ...PRODUCTION, NEXT_PHASE: "phase-production-build" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(load()).resolves.toBeDefined();
    expect(warn).not.toHaveBeenCalled();
  });
});
