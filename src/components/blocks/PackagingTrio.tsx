import Image from "next/image";
import { getDictionary } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";

/**
 * THE THREE PIECES — the client's own photograph of the terracotta sleeve,
 * the burgundy bag and the olive bag, each holding its pastel bouquet.
 *
 * It replaced the identity book's three cut-outs on 10 Oct 2026 at her
 * request ("replace this please, with this"). The picture is cropped below
 * the deck's header and its white ground is lifted to transparency, so the
 * three pieces stand on whatever paper the section has, as the cut-outs
 * did. Doubled with neural super-resolution for Retina screens.
 *
 * `withTag` is accepted for the callers that still pass it; the picture is
 * complete as she made it, so nothing is laid over it.
 */
export async function PackagingTrio({ className }: { className?: string; withTag?: boolean }) {
  const { t } = await getDictionary();

  return (
    <div className={cn("relative", className)}>
      <Image
        src="/brand/ai/trio.webp"
        alt={t.alt.packagingTrio}
        width={2400}
        height={1040}
        sizes="(max-width: 1024px) 92vw, 46vw"
        quality={90}
        className="h-auto w-full"
      />
    </div>
  );
}
