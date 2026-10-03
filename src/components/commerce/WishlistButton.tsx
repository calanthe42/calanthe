"use client";

import { IconHeart } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/locale";
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
  const t = useT();
  const saved = has(productId);

  return (
    <button
      type="button"
      aria-label={(saved ? t.ui.wishlistRemove : t.ui.wishlistAdd).replace(
        "{name}",
        productName,
      )}
      aria-pressed={saved}
      onClick={() => {
        toggle(productId);
        toast(
          (saved ? t.ui.wishlistRemoved : t.ui.wishlistSaved).replace(
            "{name}",
            productName,
          ),
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
