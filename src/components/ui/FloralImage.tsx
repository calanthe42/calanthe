import Image from "next/image";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { cn } from "@/lib/cn";
import { checkImageSrc, reportUnusableImage } from "@/lib/image-src";
import type { ProductImage } from "@/lib/data";

type FloralImageProps = {
  image: ProductImage;
  /** next/image responsive sizes — required for real photos. */
  sizes?: string;
  /** Above-the-fold imagery only (hero). */
  priority?: boolean;
  className?: string;
};

/**
 * THE image slot for all floral imagery — product, shop, home, occasions,
 * cart and checkout all render through here. Shows the curated photograph
 * when there is a usable one, and the generated botanical placeholder
 * otherwise. Swapping in the client's real photography is a data change
 * (ProductImage.src), never a component edit.
 *
 * A BROKEN PHOTOGRAPH MUST NEVER COST THE PAGE. `next/image` throws during
 * render when given a URL whose host is not in `images.remotePatterns`, and
 * in a Server Component a throw is a 500 — one bad media row taking down a
 * product page. `checkImageSrc` decides first, so anything unrenderable
 * becomes the placeholder and is reported instead of thrown. That is not
 * hypothetical here: a media record written by a local session carried a
 * `http://localhost:3000/...` URL that no deployment can fetch.
 */
export function FloralImage({ image, sizes, priority, className }: FloralImageProps) {
  const verdict = checkImageSrc(image.src);

  if (verdict.kind === "unusable") {
    /* Reported, not thrown, and not silent: a placeholder where a
       photograph should be is a content fault someone has to fix. */
    reportUnusableImage(verdict.src, verdict.reason, image.alt);
  }

  if (verdict.kind === "ok") {
    return (
      <div className={cn("relative h-full w-full", className)}>
        <Image
          src={verdict.src}
          alt={image.alt}
          fill
          sizes={sizes ?? "100vw"}
          priority={priority}
          className="floral-grade object-cover"
        />
      </div>
    );
  }

  return (
    <BotanicalPlaceholder
      seed={image.placeholder.seed}
      palette={image.placeholder.palette}
      className={className}
    />
  );
}
