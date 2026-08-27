"use client";

import { IconHeart } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useToast } from "@/lib/toast";
import { useWishlist } from "@/lib/wishlist";

type WishlistButtonProps = {
  productId: string;
  productName: string;
  className?: string;
};

export function WishlistButton({
  productId,
  productName,
  className,
}: WishlistButtonProps) {
  const { has, toggle } = useWishlist();
  const { toast } = useToast();
  const saved = has(productId);

  return (
    <button
      type="button"
      aria-label={
        saved ? `Remove ${productName} from wishlist` : `Add ${productName} to wishlist`
      }
      aria-pressed={saved}
      onClick={() => {
        toggle(productId);
        toast(
          saved
            ? `${productName} removed from your wishlist`
            : `${productName} saved to your wishlist`,
        );
      }}
      className={cn(
        "flex h-11 w-11 items-center justify-center transition-[opacity,transform] duration-200 ease-bloom hover:opacity-70 active:scale-90",
        className,
      )}
    >
      <IconHeart
        className={cn(
          "h-5 w-5 drop-shadow-[0_1px_2px_rgba(43,47,27,0.4)]",
          saved && "[&_path]:fill-current",
        )}
      />
    </button>
  );
}
