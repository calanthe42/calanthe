import { randomInt } from "node:crypto";

/**
 * The one-time password an owner hands to a new florist.
 *
 * WHY THIS EXISTS AT ALL. With no email provider wired yet, a staff account
 * has to arrive in the world with a password somehow. The alternatives were
 * both worse: letting the owner type one (she would reuse it, or choose
 * "calanthe2024" for everyone), or emailing a link that currently goes to the
 * server console and therefore nowhere. This generates a strong password the
 * owner reads out or pastes into WhatsApp, which is exactly how a small
 * atelier actually onboards someone.
 *
 * WHEN EMAIL LANDS this does not change — the same password is generated and
 * sent by mail instead of shown on screen.
 *
 * MEANT TO BE READ ALOUD. Grouped in fours with hyphens, and drawn from an
 * alphabet with no 0/O, 1/I/L or 5/S, because the failure mode of a spoken
 * password is not brute force, it is "was that an I or an l" three times over
 * and then a locked account.
 */

/* 29 symbols: 7 digits (no 0, 1 or 5) and 22 letters (no I, L, O or S), each
   unambiguous both spoken and read in the admin's typeface. */
const ALPHABET = "2346789ABCDEFGHJKMNPQRTUVWXYZ";

const GROUPS = 4;
const GROUP_SIZE = 4;

/**
 * 16 characters from a 29-symbol alphabet — about 77 bits of entropy, which
 * is far beyond anything guessable and still short enough to read out.
 *
 * randomInt, not Math.random: this is a credential, and Math.random is a
 * predictable generator seeded per process. `randomInt` also samples without
 * modulo bias, which a naive `% ALPHABET.length` would not.
 */
export function temporaryPassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g += 1) {
    let group = "";
    for (let i = 0; i < GROUP_SIZE; i += 1) {
      group += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

/** Exported for the test, which must assert the alphabet is unambiguous. */
export const TEMPORARY_PASSWORD_ALPHABET = ALPHABET;
