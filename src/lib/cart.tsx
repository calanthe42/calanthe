"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type { AddonId, PlaceholderPalette, SizeId } from "@/lib/data";
import { addons, sizes } from "@/lib/data";

export type CartItem = {
  /** productId + size + sorted addons — one line per configuration. */
  key: string;
  productId: string;
  slug: string;
  name: string;
  image: { seed: string; palette: PlaceholderPalette };
  basePriceAed: number;
  sizeId: SizeId;
  addonIds: readonly AddonId[];
  qty: number;
  giftMessage?: string;
};

export function itemUnitPrice(item: CartItem): number {
  const size = sizes.find((s) => s.id === item.sizeId);
  const addonTotal = item.addonIds.reduce(
    (sum, id) => sum + (addons.find((a) => a.id === id)?.priceAed ?? 0),
    0,
  );
  return item.basePriceAed + (size?.priceDeltaAed ?? 0) + addonTotal;
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          dispatch({ type: "hydrate", items: parsed as CartItem[] });
        }
      }
    } catch {
      /* corrupt storage — start empty */
    }
  }, []);

  useEffect(() => {
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

  const value: CartContextValue = {
    items: state.items,
    subtotalAed,
    count,
    isOpen,
    openCart: useCallback(() => setIsOpen(true), []),
    closeCart: useCallback(() => setIsOpen(false), []),
    addItem: useCallback((item) => {
      dispatch({ type: "add", item });
      setIsOpen(true);
    }, []),
    removeItem: useCallback((key) => dispatch({ type: "remove", key }), []),
    setQty: useCallback((key, qty) => dispatch({ type: "setQty", key, qty }), []),
    clear: useCallback(() => dispatch({ type: "clear" }), []),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
