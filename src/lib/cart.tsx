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
import { quoteCheckout } from "@backend/actions/checkout";
import type { AddonId, ProductImage, SizeId } from "@/lib/data";
import { addons, deliveryZones, sizes, timeSlots } from "@/lib/data";
import {
  cartSaleOf,
  itemRegularUnitFils,
  itemUnitFils,
  type CartSale,
} from "@/lib/cart-pricing";
import { CODE_MAX_LENGTH, normaliseCode } from "@/lib/discounts";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Product } from "@/lib/data";

/* The arithmetic lives in lib/cart-pricing.ts (pure, and tested against the
   server's). Re-exported so every cart view keeps importing from one place. */
export {
  itemRegularUnitFils,
  itemRegularUnitPrice,
  itemUnitFils,
  itemUnitPrice,
} from "@/lib/cart-pricing";

export type CartItem = {
  /** productId + size + sorted addons — one line per configuration. */
  key: string;
  productId: string;
  slug: string;
  name: string;
  image: ProductImage;
  /** The product's REGULAR base price. A sale never changes this. */
  basePriceAed: number;
  /**
   * The sale this product is on, when it is on one. ALWAYS taken from the
   * live catalogue — on hydration and on every re-sync — never from storage,
   * so a basket left overnight cannot keep yesterday's offer.
   */
  sale?: CartSale;
  sizeId: SizeId;
  addonIds: readonly AddonId[];
  qty: number;
  giftMessage?: string;
  /** Chosen on the product page; pre-fills checkout. */
  preferredDay?: string;
  preferredSlot?: string;
  recipientName?: string;
  recipientPhone?: string;
};

/**
 * "Deluxe · Vase · Chocolates" — one description used by every cart view.
 *
 * The size and add-on names come from the `sizes` and `addons` tables, which
 * are configuration in code and therefore English. That put three English
 * words under every line of an Arabic cart and an Arabic order summary, so
 * the dictionary answers first and the table is the fallback — which keeps an
 * add-on introduced later visible rather than blank.
 */
export function describeCartItem(
  item: Pick<CartItem, "sizeId" | "addonIds">,
  t: Dictionary,
): string {
  const parts = [
    t.sizeNames[item.sizeId] ?? sizes.find((s) => s.id === item.sizeId)?.name,
    ...item.addonIds.map(
      (id) => t.addonNames[id] ?? addons.find((a) => a.id === id)?.name,
    ),
  ].filter((x): x is string => Boolean(x));
  return parts.join(" · ");
}

type CartState = { items: CartItem[] };

type CartAction =
  | { type: "add"; item: Omit<CartItem, "key"> }
  | { type: "remove"; key: string }
  | { type: "setQty"; key: string; qty: number }
  | { type: "addAddon"; key: string; addonId: AddonId }
  | { type: "clear" }
  | { type: "hydrate"; items: CartItem[] }
  | { type: "sync"; catalogue: readonly Product[] };

function keyOf(item: Omit<CartItem, "key">): string {
  return `${item.productId}|${item.sizeId}|${[...item.addonIds].sort().join(",")}|${item.giftMessage ?? ""}`;
}

/**
 * Rebuild stored lines against the live catalog: unknown products are
 * dropped; name, slug, image, price and sale always come from the catalog so
 * stale or tampered storage can never change what is charged.
 */
function sanitizeStoredItems(parsed: unknown, products: readonly Product[]): CartItem[] {
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
      /* From the catalogue, never from storage. */
      sale: cartSaleOf(product.sale),
      sizeId,
      addonIds,
      qty,
      giftMessage:
        typeof r.giftMessage === "string" && r.giftMessage.trim()
          ? r.giftMessage.slice(0, 220)
          : undefined,
      preferredDay: typeof r.preferredDay === "string" ? r.preferredDay : undefined,
      recipientName:
        typeof r.recipientName === "string" ? r.recipientName.slice(0, 80) : undefined,
      recipientPhone:
        typeof r.recipientPhone === "string" ? r.recipientPhone.slice(0, 24) : undefined,
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
    case "addAddon": {
      return {
        items: state.items.map((i) => {
          if (i.key !== action.key || i.addonIds.includes(action.addonId)) {
            return i;
          }
          const next = { ...i, addonIds: [...i.addonIds, action.addonId] };
          return { ...next, key: keyOf(next) };
        }),
      };
    }
    case "clear":
      return { items: [] };
    case "hydrate":
      return { items: action.items };
    case "sync": {
      /* Name, photograph, price and sale are re-read from the catalogue the
         server just sent; a line whose product has left is dropped. The same
         state object is returned when nothing changed, so a refresh that
         brought no news re-renders nothing and re-quotes nothing. */
      let changed = false;
      const items: CartItem[] = [];
      for (const item of state.items) {
        const product = action.catalogue.find((p) => p.id === item.productId);
        if (!product) {
          changed = true;
          continue;
        }
        const sale = cartSaleOf(product.sale);
        const same =
          item.name === product.name &&
          item.slug === product.slug &&
          item.basePriceAed === product.priceAed &&
          JSON.stringify(item.sale ?? null) === JSON.stringify(sale ?? null);
        if (same) {
          items.push(item);
          continue;
        }
        changed = true;
        items.push({
          ...item,
          name: product.name,
          slug: product.slug,
          image: product.images[0],
          basePriceAed: product.priceAed,
          sale,
        });
      }
      return changed ? { items } : state;
    }
  }
}

/** What the basket holds, as far as its price is concerned. */
function linesKeyOf(items: readonly CartItem[]): string {
  return items
    .map(
      (i) =>
        `${i.productId}|${i.sizeId}|${[...i.addonIds].sort().join(",")}|${i.qty}|${itemUnitFils(i)}`,
    )
    .join(";");
}

/**
 * Refusals that say a code does not exist, is spent, or that this caller has
 * guessed too often. Each automatic re-quote of such a code would spend one
 * of the caller's few wrong-code attempts (backend/security/throttle.ts), so
 * after one of these the basket stops asking on its own: the code is checked
 * again only when the customer presses Apply.
 */
const FINAL_REFUSALS: readonly string[] = ["CODE_INVALID", "CODE_EXHAUSTED", "RATE_LIMITED"];

export type DiscountState = "idle" | "checking" | "error";

type CartContextValue = {
  items: readonly CartItem[];
  /**
   * False until the stored cart has been read back.
   *
   * The first render always has zero items, so without this the drawer shows
   * "your cart is empty" to a returning customer for a frame before their
   * basket appears. Empty and not-yet-known are different states and must
   * look different.
   */
  hydrated: boolean;
  /**
   * Lines dropped on hydration because the product is no longer in the
   * catalogue. Silently shrinking someone's basket is worse than saying so.
   */
  droppedCount: number;
  subtotalAed: number;
  /** The same subtotal in fils — sale prices applied, no code, no delivery. */
  subtotalFils: number;
  /** What the automatic sales took off. Already reflected in the subtotal. */
  saleSavingsFils: number;
  /**
   * The discount code the customer typed, whether or not it applied. Text
   * only: the amount it takes off always comes from the server's quote.
   */
  discountCode: string | null;
  /** The code that IS applied to this basket, with what the server says it takes off. */
  discount: { code: string; discountFils: number } | null;
  discountState: DiscountState;
  /** Why the code did not apply, in the reader's language. Null beside "error": it could not be checked. */
  discountMessage: string | null;
  /** Subtotal minus the code. Delivery is added by checkout, where the emirate is known. */
  totalFils: number;
  applyDiscountCode: (code: string) => void;
  removeDiscountCode: () => void;
  /** Checkout reports a code the server refused when the order was placed. */
  refuseDiscountCode: (message: string) => void;
  count: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "key">) => void;
  removeItem: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  addAddonToItem: (key: string, addonId: AddonId) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "calanthe-cart-v1";
/** The code as typed — text only, never an amount. */
const CODE_STORAGE_KEY = "calanthe-code-v1";

/* A stable empty catalogue: a fresh `[]` default on every render would look
   like a new catalogue to the re-sync effect each time. */
const NO_CATALOGUE: readonly Product[] = [];

/** The server's answer for one basket: applied, or refused and why. */
type Quoted = { code: string; key: string; discountFils: number };
type Refused = { code: string; key: string; message: string | null; final: boolean };

export function CartProvider({
  children,
  /* The catalogue is fetched on the server and passed in — a client provider
     must never reach for the database itself. Defaults to empty so the
     provider still mounts in isolation (tests, storybook-style rendering). */
  catalogue = NO_CATALOGUE,
}: {
  children: React.ReactNode;
  catalogue?: readonly Product[];
}) {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const [isOpen, setIsOpen] = useState(false);
  /* Never persist until the stored cart has been read, or the initial
     empty state would clobber it. The ref guards the effect; the state is
     what the UI can actually see. */
  const hydrated = useRef(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [droppedCount, setDroppedCount] = useState(0);

  /*
   * THE DISCOUNT CODE.
   *
   * The browser holds the TEXT of the code and nothing else. What it takes
   * off is whatever the server's quote says (backend/actions/checkout.ts
   * `quoteCheckout`), asked again whenever the basket changes, because a
   * percentage of a different subtotal is a different amount. The server
   * checks the code a second time when the order is placed.
   *
   * `quoted` and `refused` remember which basket the answer was for. A
   * basket that has changed since is "checking", not "applied" — so the pay
   * buttons wait rather than show a discount worked out for another basket.
   */
  const [code, setCode] = useState<string | null>(null);
  const [quoted, setQuoted] = useState<Quoted | null>(null);
  const [refused, setRefused] = useState<Refused | null>(null);
  /* Bumped by Apply, so pressing it again re-asks even for the same text. */
  const [attempt, setAttempt] = useState(0);
  const immediate = useRef(false);

  useEffect(() => {
    /* Once only. The catalogue is a dependency because sanitising needs it,
       but re-running would replace the live cart with the stored one. */
    if (hydrated.current) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        const items = sanitizeStoredItems(stored, catalogue);
        if (Array.isArray(stored) && stored.length > items.length) {
          setDroppedCount(stored.length - items.length);
        }
        dispatch({ type: "hydrate", items });
      }
      const storedCode = normaliseCode(localStorage.getItem(CODE_STORAGE_KEY) ?? "");
      if (storedCode) setCode(storedCode.slice(0, CODE_MAX_LENGTH));
    } catch {
      /* corrupt storage — start empty */
    }
    hydrated.current = true;
    setIsHydrated(true);
  }, [catalogue]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      /* storage unavailable */
    }
  }, [state.items]);

  /*
   * THE BASKET FOLLOWS THE CATALOGUE.
   *
   * It used to read prices from the catalogue once, on hydration, and never
   * again — fine while a price could only change by an edit in /admin, not
   * fine now that a sale starts and ends on a clock. When checkout answers
   * PRICE_CHANGED it calls router.refresh(); the layout sends a new
   * catalogue, and this is what makes the basket actually take it.
   *
   * An empty catalogue is "not known" (the read failed), never "everything
   * was removed": it must not empty a basket.
   */
  useEffect(() => {
    if (!hydrated.current || catalogue.length === 0) return;
    dispatch({ type: "sync", catalogue });
  }, [catalogue]);

  const subtotalFils = useMemo(
    () => state.items.reduce((sum, i) => sum + itemUnitFils(i) * i.qty, 0),
    [state.items],
  );
  const saleSavingsFils = useMemo(
    () =>
      state.items.reduce(
        (sum, i) => sum + Math.max(0, itemRegularUnitFils(i) - itemUnitFils(i)) * i.qty,
        0,
      ),
    [state.items],
  );
  const subtotalAed = subtotalFils / 100;
  const count = useMemo(
    () => state.items.reduce((sum, i) => sum + i.qty, 0),
    [state.items],
  );
  const linesKey = useMemo(() => linesKeyOf(state.items), [state.items]);
  const hasLines = state.items.length > 0;

  useEffect(() => {
    if (!isHydrated) return;
    try {
      /* A code that was finally refused is not kept: reloading the page
         would ask about it again, and each ask costs an attempt. */
      if (code && !(refused?.code === code && refused.final)) {
        localStorage.setItem(CODE_STORAGE_KEY, code);
      } else {
        localStorage.removeItem(CODE_STORAGE_KEY);
      }
    } catch {
      /* storage unavailable */
    }
  }, [code, refused, isHydrated]);

  useEffect(() => {
    if (!isHydrated || !code || !hasLines) return;
    /* Already answered for this code and this basket. */
    if (refused?.code === code && (refused.final || refused.key === linesKey)) return;
    if (quoted?.code === code && quoted.key === linesKey) return;

    let cancelled = false;
    const key = linesKey;
    const lines = state.items.map((item) => ({
      productId: item.productId,
      quantity: item.qty,
      sizeId: item.sizeId,
      addonIds: [...item.addonIds],
    }));
    /* A quantity stepper pressed five times asks once. */
    const delay = immediate.current ? 0 : 400;
    immediate.current = false;

    const timer = setTimeout(() => {
      quoteCheckout({
        lines,
        /* The code's value does not depend on the emirate; the server only
           needs one it serves. Checkout adds delivery where it is chosen. */
        deliveryEmirate: deliveryZones[0]?.id ?? "",
        discountCode: code,
      })
        .then((result) => {
          if (cancelled) return;
          if (result.ok && result.quote.couponDiscountFils > 0) {
            setRefused(null);
            setQuoted({ code, key, discountFils: result.quote.couponDiscountFils });
            return;
          }
          setQuoted(null);
          setRefused(
            result.ok
              ? { code, key, message: null, final: false }
              : {
                  code,
                  key,
                  message: result.message,
                  final: FINAL_REFUSALS.includes(result.code),
                },
          );
        })
        .catch(() => {
          /* The network dropped: say so, and ask again when the basket changes. */
          if (cancelled) return;
          setQuoted(null);
          setRefused({ code, key, message: null, final: false });
        });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    /* `quoted`, `refused` and the items are read, not watched: the first two
       are what this effect writes, and `linesKey` already says everything
       about the items that a quote depends on. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, code, linesKey, attempt]);

  const discount = useMemo(
    () =>
      code && hasLines && quoted?.code === code && quoted.key === linesKey
        ? { code, discountFils: Math.min(quoted.discountFils, subtotalFils) }
        : null,
    [code, hasLines, quoted, linesKey, subtotalFils],
  );
  const isRefused =
    code !== null &&
    refused?.code === code &&
    (refused.final || refused.key === linesKey);
  const discountState: DiscountState =
    !code || !hasLines || discount ? "idle" : isRefused ? "error" : "checking";
  const discountMessage = discountState === "error" ? (refused?.message ?? null) : null;
  const totalFils = subtotalFils - (discount?.discountFils ?? 0);

  const applyDiscountCode = useCallback((raw: string) => {
    const next = normaliseCode(raw).slice(0, CODE_MAX_LENGTH);
    if (!next) return;
    immediate.current = true;
    setQuoted(null);
    setRefused(null);
    setCode(next);
    setAttempt((n) => n + 1);
  }, []);
  const removeDiscountCode = useCallback(() => {
    setCode(null);
    setQuoted(null);
    setRefused(null);
  }, []);
  const refuseDiscountCode = useCallback(
    (message: string) => {
      setQuoted(null);
      /* Final: the server has just said no to this code for this customer;
         it is not asked again, or sent again, until she presses Apply. */
      setRefused((current) =>
        code ? { code, key: linesKey, message, final: true } : current,
      );
    },
    [code, linesKey],
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
  const addAddonToItem = useCallback(
    (key: string, addonId: AddonId) => dispatch({ type: "addAddon", key, addonId }),
    [],
  );
  const clear = useCallback(() => {
    dispatch({ type: "clear" });
    /* A paid order has used its code; the next basket starts without one. */
    setCode(null);
    setQuoted(null);
    setRefused(null);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      hydrated: isHydrated,
      droppedCount,
      subtotalAed,
      subtotalFils,
      saleSavingsFils,
      discountCode: code,
      discount,
      discountState,
      discountMessage,
      totalFils,
      applyDiscountCode,
      removeDiscountCode,
      refuseDiscountCode,
      count,
      isOpen,
      openCart,
      closeCart,
      addItem,
      removeItem,
      setQty,
      addAddonToItem,
      clear,
    }),
    [
      state.items,
      isHydrated,
      droppedCount,
      subtotalAed,
      subtotalFils,
      saleSavingsFils,
      code,
      discount,
      discountState,
      discountMessage,
      totalFils,
      applyDiscountCode,
      removeDiscountCode,
      refuseDiscountCode,
      count,
      isOpen,
      openCart,
      closeCart,
      addItem,
      removeItem,
      setQty,
      addAddonToItem,
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
