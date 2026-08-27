import type { Metadata } from "next";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { MonogramBloom } from "@/components/motion/MonogramBloom";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { SplitLines } from "@/components/motion/SplitLines";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Logotype } from "@/components/ui/Logotype";

export const metadata: Metadata = {
  title: "Style Check",
  robots: { index: false },
};

const swatches = [
  {
    name: "Deep Olive",
    hex: "#2B2F1B",
    className: "bg-olive",
    role: "Primary text · dark surfaces",
  },
  {
    name: "Muted Sage",
    hex: "#868764",
    className: "bg-sage",
    role: "Muted text · borders · icons",
  },
  {
    name: "Burgundy",
    hex: "#2E131B",
    className: "bg-burgundy",
    role: "Intimate sections only",
  },
  {
    name: "Burnt Orange",
    hex: "#B55B29",
    className: "bg-burnt-orange",
    role: "Accent · CTA only",
  },
  { name: "Warm Cream", hex: "#E4DCC5", className: "bg-cream", role: "Cards · surfaces" },
] as const;

function Hairline() {
  return <hr className="border-0 border-t border-hairline" />;
}

export default function StyleCheckPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-14 px-6 py-16 lg:max-w-4xl">
      {/* ---- Identity ---- */}
      <header className="flex flex-col items-center gap-4 text-center">
        <Logotype className="text-3xl" />
        <Eyebrow>Style Check — Foundation</Eyebrow>
      </header>

      <Hairline />

      {/* ---- Type specimen ---- */}
      <section className="flex flex-col gap-6">
        <Eyebrow>01 — Typography</Eyebrow>
        <div className="flex flex-col gap-5">
          <Eyebrow className="text-olive">Flower Atelier — UAE</Eyebrow>
          <h1 className="font-display text-5xl font-light leading-[1.05] text-olive lg:text-7xl">
            Where feelings <em className="font-normal">take form.</em>
          </h1>
          <p className="max-w-prose text-base leading-relaxed text-olive">
            Every arrangement leaves the atelier hand-composed, stem by stem — seasonal
            blooms chosen the same morning they are delivered. Instrument Sans carries the
            quiet work of body copy, interface labels, and prices.
          </p>
          <p className="font-sans text-base text-olive">
            Bordeaux in Bloom — <span className="text-sage">AED 420</span>
          </p>
        </div>
      </section>

      <Hairline />

      {/* ---- Color ---- */}
      <section className="flex flex-col gap-6">
        <Eyebrow>02 — Color</Eyebrow>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {swatches.map((swatch) => (
            <li
              key={swatch.hex}
              className="overflow-hidden rounded-sm border border-hairline"
            >
              <div className={`h-24 ${swatch.className}`} />
              <div className="flex flex-col gap-0.5 bg-cream px-4 py-3">
                <p className="font-brand text-xs uppercase tracking-brand text-olive">
                  {swatch.name}
                </p>
                <p className="text-sm text-sage">
                  {swatch.hex} · {swatch.role}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm text-sage">
          Page background #F3EFDF · Hairlines #CBC4A9 — shown by this page itself.
        </p>
      </section>

      <Hairline />

      {/* ---- Buttons ---- */}
      <section className="flex flex-col gap-6">
        <Eyebrow>03 — Buttons</Eyebrow>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button variant="primary" className="w-full sm:w-auto">
            Shop Flowers
          </Button>
          <Button variant="secondary" className="w-full sm:w-auto">
            Build Your Own
          </Button>
        </div>
        <div className="flex flex-col gap-4 rounded-sm bg-olive px-6 py-8">
          <Eyebrow className="text-cream/70">On deep olive — cream pairing</Eyebrow>
          <div>
            <Button variant="secondary-cream" className="w-full sm:w-auto">
              Explore Occasions
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-sm bg-burgundy px-6 py-8">
          <Eyebrow className="text-cream/70">Burgundy — intimate sections only</Eyebrow>
          <p className="font-display text-2xl font-light italic text-cream">
            For the words you cannot say out loud.
          </p>
        </div>
      </section>

      <Hairline />

      {/* ---- Motion lab: one full-screen block per primitive ---- */}
      <section className="flex min-h-svh flex-col justify-center gap-6">
        <Eyebrow>04 — Motion · Reveal</Eyebrow>
        <Reveal>
          <p className="max-w-prose font-display text-3xl font-light text-olive">
            The default entrance — a quiet fade as the content rises 24 pixels, like a
            stem straightening.
          </p>
        </Reveal>
      </section>

      <section className="flex min-h-svh flex-col justify-center gap-6">
        <Eyebrow>05 — Motion · ClipReveal</Eyebrow>
        <ClipReveal className="aspect-[4/5] w-full max-w-sm rounded-sm">
          <BotanicalPlaceholder seed="clip-demo" palette="warm" />
        </ClipReveal>
      </section>

      <section className="flex min-h-svh flex-col justify-center gap-6">
        <Eyebrow>06 — Motion · Stagger</Eyebrow>
        <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {["One", "Two", "Three"].map((label, i) => (
            <StaggerItem key={label}>
              <div className="flex aspect-[4/3] items-center justify-center rounded-sm bg-cream">
                <span className="font-brand text-xs uppercase tracking-brand text-sage">
                  {label} · {(i + 1) * 80}ms
                </span>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="flex min-h-svh flex-col justify-center gap-6">
        <Eyebrow>07 — Motion · SplitLines</Eyebrow>
        <SplitLines
          lines={["Lines that rise", "out of the page,", "one breath apart."]}
          className="font-display text-5xl font-light leading-[1.08] text-olive"
        />
      </section>

      <section className="flex min-h-svh flex-col justify-center gap-6">
        <Eyebrow>08 — Motion · Parallax</Eyebrow>
        <div className="grid grid-cols-3 gap-3">
          <Parallax speed={0.9} className="aspect-[4/5] overflow-hidden rounded-sm">
            <BotanicalPlaceholder seed="par-a" palette="olive" />
          </Parallax>
          <Parallax speed={1} className="mt-10 aspect-[4/5] overflow-hidden rounded-sm">
            <BotanicalPlaceholder seed="par-b" palette="warm" />
          </Parallax>
          <Parallax speed={1.1} className="aspect-[4/5] overflow-hidden rounded-sm">
            <BotanicalPlaceholder seed="par-c" palette="burgundy" />
          </Parallax>
        </div>
        <p className="text-sm text-sage">Speeds 0.9 · 1.0 · 1.1 — scroll slowly.</p>
      </section>

      <section className="flex min-h-svh flex-col items-center justify-center gap-6">
        <Eyebrow>09 — Motion · MonogramBloom</Eyebrow>
        <MonogramBloom className="w-40 text-olive" title="Calanthe monogram" />
        <p className="text-sm text-sage">The true vector mark, drawing on.</p>
      </section>

      <Hairline />

      <footer className="pb-8 text-center">
        <p className="text-sm text-sage">
          CALANTHE foundation · verify at 390px · grain 3.5%
        </p>
      </footer>
    </main>
  );
}
