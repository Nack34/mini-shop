"use client";

import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { cartReducer, type CartAction, type CartLine } from "@/lib/cart";

const KEY = "mini-shop-cart";
const CartContext = createContext<{ lines: CartLine[]; dispatch: (a: CartAction) => void } | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(cartReducer, []);
  const loaded = useRef(false);

  // Load once on the client (localStorage doesn't exist during server rendering), then persist.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) dispatch({ type: "load", lines: JSON.parse(saved) });
    } catch {
      /* storage unavailable or corrupted: start empty */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines]);

  return <CartContext.Provider value={{ lines, dispatch }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  return value;
}
