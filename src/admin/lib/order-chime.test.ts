import { describe, expect, it } from "vitest";
import { CHIME_SECONDS, playOrderChime } from "./order-chime";

/**
 * The new-order sound the owner chose by ear. These tests pin what she
 * heard — the five notes, their order and how long the chime rings — so a
 * later edit cannot quietly turn it back into something harsh.
 */

type Scheduled = { type: string; frequency: number; start: number; stop: number };

function fakeContext() {
  const oscillators: Scheduled[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  });
  const node = () => ({ connect: (next: unknown) => next });
  const ctx = {
    currentTime: 10,
    destination: node(),
    createBiquadFilter: () => ({ ...node(), type: "", frequency: param() }),
    createDynamicsCompressor: () => ({ ...node(), threshold: param(), ratio: param() }),
    createGain: () => ({ ...node(), gain: param() }),
    createOscillator: () => {
      const scheduled: Scheduled = { type: "", frequency: 0, start: 0, stop: 0 };
      oscillators.push(scheduled);
      return {
        ...node(),
        set type(value: string) {
          scheduled.type = value;
        },
        frequency: {
          set value(hz: number) {
            scheduled.frequency = hz;
          },
        },
        start: (at: number) => (scheduled.start = at),
        stop: (at: number) => (scheduled.stop = at),
      };
    },
  };
  return { ctx: ctx as unknown as AudioContext, oscillators };
}

describe("playOrderChime", () => {
  it("strikes F♯6, A6, D6, B6 and E6, in that order, with soft sine tones only", () => {
    const { ctx, oscillators } = fakeContext();
    playOrderChime(ctx);

    const fundamentals = oscillators.filter((_, index) => index % 3 === 0);
    expect(fundamentals.map((o) => Math.round(o.frequency))).toEqual([1480, 1760, 1175, 1976, 1319]);
    expect(fundamentals.map((o) => o.start)).toEqual([...fundamentals.map((o) => o.start)].sort((a, b) => a - b));
    expect(oscillators.every((o) => o.type === "sine")).toBe(true);
    expect(oscillators).toHaveLength(15);
  });

  it("is over well before the next ring, five seconds later", () => {
    const { ctx, oscillators } = fakeContext();
    playOrderChime(ctx);

    const last = Math.max(...oscillators.map((o) => o.stop)) - 10;
    expect(last).toBeLessThan(5);
    expect(CHIME_SECONDS).toBeLessThan(5);
  });
});
