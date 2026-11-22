"use client";

import Link from "next/link";
import { itemCount } from "@/lib/cart";
import { useCart } from "./cart-context";

export function CartBadge() {
  const { lines } = useCart();
  const count = itemCount(lines);
  return (
    <Link href="/cart" className="cart-link" aria-label={`Cart, ${count} items`}>
      Cart <span className="badge">{count}</span>
    </Link>
  );
}
