"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type WishlistContextValue = {
  ids: readonly string[];
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

const STORAGE_KEY = "calanthe-wishlist-v1";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setIds(parsed.filter((x) => typeof x === "string"));
      }
    } catch {
      /* start empty */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* storage unavailable */
    }
  }, [ids]);

  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const value = useMemo(() => ({ ids, has, toggle }), [ids, has, toggle]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
