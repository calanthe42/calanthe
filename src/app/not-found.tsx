import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Monogram } from "@/components/ui/Monogram";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-burgundy px-6 text-center">
      <Monogram className="w-16 text-cream/80" />
      <Eyebrow className="text-cream/60">404</Eyebrow>
      <h1 className="max-w-md font-display text-4xl font-light text-cream lg:text-5xl">
        This page has wilted.
      </h1>
      <p className="max-w-sm text-base leading-relaxed text-cream/70">
        The address you followed is no longer in bloom — but the atelier is.
      </p>
      <Link href="/" className={buttonClasses("secondary-cream", "mt-2")}>
        Return Home
      </Link>
    </main>
  );
}
