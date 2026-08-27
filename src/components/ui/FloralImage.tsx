import Image from "next/image";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { cn } from "@/lib/cn";
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
 * THE image slot for all floral imagery. Renders the curated photograph
 * when `image.src` is set, falling back to the generated botanical
 * placeholder otherwise. Swapping in the client's real photography is a
 * data change (ProductImage.src) — no component edits needed.
 */
export function FloralImage({ image, sizes, priority, className }: FloralImageProps) {
  if (image.src) {
    return (
      <div className={cn("relative h-full w-full", className)}>
        <Image
          src={image.src}
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
