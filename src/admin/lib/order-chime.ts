/**
 * The sound of a new order: wind chimes, like the chime on a shop door.
 *
 * It replaced a telephone ring (two square-wave buzzes at 440 + 480 Hz)
 * that the owner found frightening. She chose this one by ear on 30 Oct 2026
 * from four calm candidates, so the notes and their timing below are hers;
 * change them only with her.
 *
 * Five notes from a D major pentatonic, each a struck tube: a sine at the
 * note and two softer, quicker overtones at the tube's own ratios (2.76× and
 * 5.4×), rolled off above 7 kHz and evened by a compressor so no note is
 * sharper than the rest. Drawn with the Web Audio API, so there is no sound
 * file to load or cache.
 */

/* [frequency in Hz, start in seconds, loudness 0–1]: F♯6 A6 D6 B6 E6. */
const NOTES: ReadonlyArray<readonly [number, number, number]> = [
  [1479.98, 0, 0.85],
  [1760.0, 0.12, 0.65],
  [1174.66, 0.25, 0.8],
  [1975.53, 0.39, 0.55],
  [1318.51, 0.55, 0.7],
];

/* [ratio to the note, loudness, share of the full decay]. */
const PARTIALS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 1],
  [2.76, 0.35, 0.45],
  [5.4, 0.12, 0.25],
];

const DECAY_S = 2.6;
const PEAK = 0.26;
const ATTACK_S = 0.003;

/** How long one chime rings, from its first note to the last fading out. */
export const CHIME_SECONDS = NOTES[NOTES.length - 1]![1] + DECAY_S;

/** Play the chime once on `ctx`, starting a moment from now. */
export function playOrderChime(ctx: AudioContext): void {
  const at = ctx.currentTime + 0.03;
  const soften = ctx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 7000;
  const even = ctx.createDynamicsCompressor();
  even.threshold.value = -18;
  even.ratio.value = 4;
  soften.connect(even).connect(ctx.destination);

  for (const [frequency, offset, velocity] of NOTES) {
    for (const [ratio, loudness, share] of PARTIALS) {
      const start = at + offset;
      const end = start + DECAY_S * share;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency * ratio;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(PEAK * loudness * velocity, start + ATTACK_S);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(soften);
      osc.start(start);
      osc.stop(end + 0.05);
    }
  }
}
