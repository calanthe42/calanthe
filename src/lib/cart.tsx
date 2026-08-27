"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { AddonId, ProductImage, SizeId } from "@/lib/data";
import { addons, products, sizes, timeSlots } from "@/lib/data";

export type CartItem = {
  /** productId + size + sorted addons — one line per configuration. */
  key: string;
  productId: string;
  slug: string;
  name: string;
  image: ProductImage;
  basePriceAed: number;
  sizeId: SizeId;
  addonIds: readonly AddonId[];
  qty: number;
  giftMessage?: string;
  /** Chosen on the product page; pre-fills checkout. */
  preferredDay?: string;
  preferredSlot?: string;
};

export function itemUnitPrice(
  item: Pick<CartItem, "basePriceAed" | "sizeId" | "addonIds">,
): number {
  const size = sizes.find((s) => s.id === item.sizeId);
  const addonTotal = item.addonIds.reduce(
    (sum, id) => sum + (addons.find((a) => a.id === id)?.priceAed ?? 0),
    0,
  );
  return item.basePriceAed + (size?.priceDeltaAed ?? 0) + addonTotal;
}

/** "Deluxe · Vase · Chocolates" — one description used by every cart view. */
export function describeCartItem(item: Pick<CartItem, "sizeId" | "addonIds">): string {
  const parts = [
    sizes.find((s) => s.id === item.sizeId)?.name,
    ...item.addonIds.map((id) => addons.find((a) => a.id === id)?.name),
  ].filter((x): x is string => Boolean(x));
  return parts.join(" · ");
}

type CartState = { items: CartItem[] };

type CartAction =
  | { type: "add"; item: Omit<CartItem, "key"> }
  | { type: "remove"; key: string }
  | { type: "setQty"; key: string; qty: number }
  | { type: "clear" }
  | { type: "hydrate"; items: CartItem[] };

function keyOf(item: Omit<CartItem, "key">): string {
  return `${item.productId}|${item.sizeId}|${[...item.addonIds].sort().join(",")}|${item.giftMessage ?? ""}`;
}

/**
 * Rebuild stored lines against the live catalog: unknown products are
 * dropped; name, slug, image and price always come from the catalog so
 * stale or tampered storage can never change what is charged.
 */
function sanitizeStoredItems(parsed: unknown): CartItem[] {
  if (!Array.isArray(parsed)) return [];
  const items: CartItem[] = [];
  for (const raw of parsed) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const product = products.find((p) => p.id === r.productId);
    if (!product) continue;

    const sizeId = sizes.some((s) => s.id === r.sizeId)
      ? (r.sizeId as SizeId)
      : "standard";
    const addonIds = Array.isArray(r.addonIds)
      ? (r.addonIds.filter((id) => addons.some((a) => a.id === id)) as AddonId[])
      : [];
    const qty =
      typeof r.qty === "number" && Number.isInteger(r.qty)
        ? Math.min(Math.max(r.qty, 1), 20)
        : 1;

    const item: Omit<CartItem, "key"> = {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      basePriceAed: product.priceAed,
      sizeId,
      addonIds,
      qty,
      giftMessage:
        typeof r.giftMessage === "string" && r.giftMessage.trim()
          ? r.giftMessage.slice(0, 220)
          : undefined,
      preferredDay: typeof r.preferredDay === "string" ? r.preferredDay : undefined,
      preferredSlot:
        typeof r.preferredSlot === "string" &&
        (timeSlots as readonly string[]).includes(r.preferredSlot)
          ? r.preferredSlot
          : undefined,
    };
    items.push({ ...item, key: keyOf(item) });
  }
  return items;
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add": {
      const key = keyOf(action.item);
      const existing = state.items.find((i) => i.key === key);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.key === key ? { ...i, qty: i.qty + action.item.qty } : i,
          ),
        };
      }
      return { items: [...state.items, { ...action.item, key }] };
    }
    case "remove":
      return { items: state.items.filter((i) => i.key !== action.key) };
    case "setQty": {
      if (action.qty < 1) {
        return { items: state.items.filter((i) => i.key !== action.key) };
      }
      return {
        items: state.items.map((i) =>
          i.key === action.key ? { ...i, qty: action.qty } : i,
        ),
      };
    }
    case "clear":
      return { items: [] };
    case "hydrate":
      return { items: action.items };
  }
}

type CartContextValue = {
  items: readonly CartItem[];
  subtotalAed: number;
  count: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "key">) => void;
  removeItem: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "calanthe-cart-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const [isOpen, setIsOpen] = useState(false);
  /* Never persist until the stored cart has been read, or the initial
     empty state would clobber it. */
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        dispatch({
          type: "hydrate",
          items: sanitizeStoredItems(JSON.parse(raw)),
        });
      }
    } catch {
      /* corrupt storage — start empty */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      /* storage unavailable */
    }
  }, [state.items]);

  const subtotalAed = useMemo(
    () => state.items.reduce((sum, i) => sum + itemUnitPrice(i) * i.qty, 0),
    [state.items],
  );
  const count = useMemo(
    () => state.items.reduce((sum, i) => sum + i.qty, 0),
    [state.items],
  );

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const addItem = useCallback((item: Omit<CartItem, "key">) => {
    dispatch({ type: "add", item });
    setIsOpen(true);
  }, []);
  const removeItem = useCallback((key: string) => dispatch({ type: "remove", key }), []);
  const setQty = useCallback(
    (key: string, qty: number) => dispatch({ type: "setQty", key, qty }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      subtotalAed,
      count,
      isOpen,
      openCart,
      closeCart,
      addItem,
      removeItem,
      setQty,
      clear,
    }),
    [
      state.items,
      subtotalAed,
      count,
      isOpen,
      openCart,
      closeCart,
      addItem,
      removeItem,
      setQty,
      clear,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
