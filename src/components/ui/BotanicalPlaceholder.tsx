import { cn } from "@/lib/cn";

type Palette = "warm" | "olive" | "burgundy";

type BotanicalPlaceholderProps = {
  /** Any string — same seed always renders the same composition. */
  seed: string;
  palette?: Palette;
  className?: string;
};

/* Brand-only colors, warm and muted — stand-ins until real photography. */
const palettes: Record<Palette, { base: string; blobs: string[] }> = {
  warm: {
    base: "#d8cfb4",
    blobs: ["#868764", "#b55b29", "#e4dcc5", "#5c6039", "#a5a37e", "#2b2f1b"],
  },
  olive: {
    base: "#3a3f26",
    blobs: ["#868764", "#2b2f1b", "#e4dcc5", "#5c6039", "#b55b29", "#4a4f2e"],
  },
  burgundy: {
    base: "#3a1a23",
    blobs: ["#2e131b", "#b55b29", "#e4dcc5", "#5a2c37", "#868764", "#46202b"],
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

/**
 * Soft-focus botanical abstraction in the brand palette — blurred
 * organic forms, like flowers seen through frosted glass. Deterministic
 * per seed. Replace with real photography when the client provides it.
 */
export function BotanicalPlaceholder({
  seed,
  palette = "warm",
  className,
}: BotanicalPlaceholderProps) {
  const { base, blobs } = palettes[palette];
  const rand = rng(seed);
  const id = `bp-${seed.replace(/[^a-zA-Z0-9-]/g, "")}`;

  const shapes = Array.from({ length: 7 }, (_, i) => {
    const cx = 12 + rand() * 76;
    const cy = 10 + rand() * 80;
    const rx = 14 + rand() * 26;
    const ry = rx * (0.7 + rand() * 0.6);
    const rot = Math.floor(rand() * 180);
    const fill = blobs[i % blobs.length] ?? base;
    const opacity = 0.35 + rand() * 0.4;
    return { cx, cy, rx, ry, rot, fill, opacity };
  });

  return (
    <svg
      viewBox="0 0 100 125"
      preserveAspectRatio="xMidYMid slice"
      className={cn("h-full w-full", className)}
      aria-hidden
    >
      <defs>
        <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <radialGradient id={`${id}-v`} cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor={base} stopOpacity="0" />
          <stop offset="100%" stopColor="#1c1f10" stopOpacity="0.28" />
        </radialGradient>
      </defs>
      <rect width="100" height="125" fill={base} />
      <g filter={`url(#${id})`}>
        {shapes.map((s, i) => (
          <ellipse
            key={i}
            cx={s.cx}
            cy={s.cy}
            rx={s.rx}
            ry={s.ry}
            fill={s.fill}
            opacity={s.opacity}
            transform={`rotate(${s.rot} ${s.cx} ${s.cy})`}
          />
        ))}
      </g>
      <rect width="100" height="125" fill={`url(#${id}-v)`} />
    </svg>
  );
}
