import { describe, expect, it } from "vitest";
import { evaluate } from "./sliding-window";

const WINDOW = 60_000;

describe("evaluate", () => {
  it("allows the first attempt against an empty history", () => {
    const result = evaluate([], 1_000, 3, WINDOW);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.kept).toEqual([1_000]);
  });

  it("allows exactly `limit` attempts and refuses the next", () => {
    let history: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const result = evaluate(history, 1_000 + i, 3, WINDOW);
      expect(result.allowed).toBe(true);
      history = result.kept;
    }

    const refused = evaluate(history, 1_010, 3, WINDOW);
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
  });

  it("does not record a refused attempt, so knocking cannot extend the lock", () => {
    const history = [1_000, 1_001, 1_002];

    const first = evaluate(history, 1_010, 3, WINDOW);
    const second = evaluate(first.kept, 30_000, 3, WINDOW);

    expect(first.kept).toEqual(history);
    expect(second.kept).toEqual(history);
    /* The wait still counts down from the ORIGINAL oldest attempt. */
    expect(second.retryAfterMs).toBeLessThan(first.retryAfterMs);
  });

  it("frees a slot once the oldest attempt leaves the window", () => {
    const history = [1_000, 40_000, 50_000];

    /* The attempt at 1_000 is still inside a 60s window at 60_999... */
    expect(evaluate(history, 60_999, 3, WINDOW).allowed).toBe(false);
    /* ...and exactly one window old at 61_000, which is outside it. */
    expect(evaluate(history, 61_000, 3, WINDOW).allowed).toBe(true);
  });

  it("counts a true sliding window, not a resetting one", () => {
    /* Three at the very end of one notional hour... */
    let history = [3_500_000, 3_550_000, 3_599_000];
    /* ...and a fourth a second later is still four in under two minutes. */
    const result = evaluate(history, 3_600_000, 3, 3_600_000);
    expect(result.allowed).toBe(false);

    history = result.kept;
    /* Only once the first has genuinely aged out does room appear. */
    expect(evaluate(history, 7_100_001, 3, 3_600_000).allowed).toBe(true);
  });

  it("reports how long until the window has room", () => {
    const result = evaluate([10_000, 11_000, 12_000], 20_000, 3, WINDOW);
    /* The oldest is at 10_000 and expires at 70_000. */
    expect(result.retryAfterMs).toBe(50_000);
  });

  it("drops timestamps older than the window rather than keeping them", () => {
    const result = evaluate([1, 2, 3, 500_000], 500_001, 10, WINDOW);
    expect(result.kept).toEqual([500_000, 500_001]);
  });

  it("treats a limit of zero as refusing everything", () => {
    const result = evaluate([], 1_000, 0, WINDOW);
    expect(result.allowed).toBe(false);
    /* Nothing is in the window, so there is nothing to wait for; the caller
       still gets a positive, non-zero figure rather than a bare 0 that would
       read as "allowed". */
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });
});
