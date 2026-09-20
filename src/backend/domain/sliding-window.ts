/**
 * A sliding-window counter, with no clock and no storage of its own.
 *
 * Kept pure so the decision itself can be unit-tested: "six attempts in ten
 * minutes" is a rule about arithmetic, and a rule you cannot test is a rule
 * you are guessing at. Where the timestamps are kept, and where `now` comes
 * from, is the caller's problem (backend/security/throttle.ts).
 *
 * WHY SLIDING AND NOT FIXED. A fixed window resets on the hour, so five
 * attempts at 10:59 and five more at 11:00 pass a "5 per hour" rule while
 * being ten attempts in one minute. A sliding window counts the last N
 * milliseconds from the moment of asking, which is what the rule means.
 */

export type Decision = {
  allowed: boolean;
  /** Attempts still available in the current window, never below zero. */
  remaining: number;
  /**
   * How long until the window has room again. Zero when allowed.
   *
   * Measured from the OLDEST attempt still inside the window, because that
   * is the one whose expiry frees the slot.
   */
  retryAfterMs: number;
  /**
   * The timestamps to keep — those inside the window, plus this attempt when
   * it was allowed. Returned rather than mutated so the function stays pure
   * and the caller decides what to persist.
   */
  kept: number[];
};

export function evaluate(
  timestamps: readonly number[],
  now: number,
  limit: number,
  windowMs: number,
): Decision {
  const cutoff = now - windowMs;
  /* Anything older than the window is gone, not merely ignored: keeping it
     would grow the array without bound on a busy key. */
  const live = timestamps.filter((at) => at > cutoff);

  if (live.length >= limit) {
    /* A refused attempt is deliberately NOT recorded. Counting refusals
       would let a caller hold their own key locked for ever simply by
       continuing to knock — the punishment would outlast the offence. */
    const oldest = Math.min(...live);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(1, oldest + windowMs - now),
      kept: live,
    };
  }

  return {
    allowed: true,
    remaining: limit - live.length - 1,
    retryAfterMs: 0,
    kept: [...live, now],
  };
}
