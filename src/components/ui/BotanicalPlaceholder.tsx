import { cn } from "@/lib/cn";

type Palette = "warm" | "olive" | "burgundy";

type BotanicalPlaceholderProps = {
  /** Any string — same seed always renders the same composition. */
  seed: string;
  palette?: Palette;
  className?: string;
};

/* Petal-toned tints mixed from the brand palette — warm and soft,
   stand-ins until real photography. */
const palettes: Record<Palette, { base: string; blobs: string[] }> = {
  warm: {
    base: "#ded3b9",
    blobs: ["#cfa583", "#b96a3a", "#ece5d2", "#a5a37e", "#d9bfa0", "#8a8b66"],
  },
  olive: {
    base: "#414628",
    blobs: ["#8a8b66", "#5c6039", "#e7dfc9", "#b06a3f", "#6b7046", "#2b2f1b"],
  },
  burgundy: {
    base: "#432129",
    blobs: ["#5f2f3a", "#b06a3f", "#e2d3c3", "#7c4650", "#8a5560", "#2e131b"],
  },
};

/** mulberry32 — tiny deterministic PRNG so SSR and client agree. */
function rng(seedStr: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Shape = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
  fill: string;
  opacity: number;
};

/* Compositions are pure functions of (seed, palette) — cached so
   re-renders never re-run the PRNG. Works on server and client. */
const shapeCache = new Map<string, Shape[]>();

function shapesFor(seed: string, palette: Palette): Shape[] {
  const cacheKey = `${palette}|${seed}`;
  const cached = shapeCache.get(cacheKey);
  if (cached) return cached;

  const { base, blobs } = palettes[palette];
  const rand = rng(seed);
  /* Hero frames get a denser, fuller bouquet. */
  const count = seed.includes("hero") ? 13 : 7;
  const shapes = Array.from({ length: count }, (_, i) => {
    const cx = 12 + rand() * 76;
    const cy = 10 + rand() * 80;
    const rx = 18 + rand() * 30;
    const ry = rx * (0.7 + rand() * 0.6);
    const rot = Math.floor(rand() * 180);
    const fill = blobs[i % blobs.length] ?? base;
    const opacity = 0.4 + rand() * 0.4;
    return { cx, cy, rx, ry, rot, fill, opacity };
  });
  shapeCache.set(cacheKey, shapes);
  return shapes;
}

/**
 * Soft-focus botanical abstraction in the brand palette — blurred
 * organic forms, like flowers seen through frosted glass. The softness
 * comes from radial-gradient falloff, not filters: feGaussianBlur cost
 * Lighthouse ~2s of Style/Layout across a page of these.
 * Deterministic per seed. Replace with real photography when available.
 */
export function BotanicalPlaceholder({
  seed,
  palette = "warm",
  className,
}: BotanicalPlaceholderProps) {
  const { base } = palettes[palette];
  const id = `bp-${palette}-${seed.replace(/[^a-zA-Z0-9-]/g, "")}`;
  const shapes = shapesFor(seed, palette);

  return (
    <svg
      viewBox="0 0 100 125"
      preserveAspectRatio="xMidYMid slice"
      className={cn("h-full w-full", className)}
      aria-hidden
    >
      <defs>
        {shapes.map((s, i) => (
          <radialGradient key={i} id={`${id}-g${i}`}>
            <stop offset="0%" stopColor={s.fill} stopOpacity={s.opacity} />
            <stop offset="55%" stopColor={s.fill} stopOpacity={s.opacity * 0.7} />
            <stop offset="100%" stopColor={s.fill} stopOpacity="0" />
          </radialGradient>
        ))}
        <radialGradient id={`${id}-v`} cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor={base} stopOpacity="0" />
          <stop offset="100%" stopColor="#1c1f10" stopOpacity="0.28" />
        </radialGradient>
      </defs>
      <rect width="100" height="125" fill={base} />
      {shapes.map((s, i) => (
        <ellipse
          key={i}
          cx={s.cx}
          cy={s.cy}
          rx={s.rx * 1.25}
          ry={s.ry * 1.25}
          fill={`url(#${id}-g${i})`}
          transform={`rotate(${s.rot} ${s.cx} ${s.cy})`}
        />
      ))}
      <rect width="100" height="125" fill={`url(#${id}-v)`} />
    </svg>
  );
}
