"use client";

import { useState } from "react";
import type { Product } from "@/lib/api";
import { useCart } from "./cart-context";

export function AddToCart({ product, withQuantity = false }: { product: Product; withQuantity?: boolean }) {
  const { lines, dispatch } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const inCart = lines.find((l) => l.slug === product.slug)?.quantity ?? 0;
  const soldOut = product.stock === 0;
  const atLimit = inCart >= product.stock;

  const add = () => {
    const { slug, name, priceCents, stock } = product;
    dispatch({ type: "add", product: { slug, name, priceCents, stock }, quantity });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  if (soldOut) return <button disabled>Sold out</button>;
  return (
    <div className="add">
      {withQuantity && (
        <label>
          Quantity
          <input
            type="number"
            min={1}
            max={product.stock}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, Number(e.target.value) || 1)))}
          />
        </label>
      )}
      <button onClick={add} disabled={atLimit}>
        {atLimit ? "All in your cart" : added ? "Added ✓" : "Add to cart"}
      </button>
    </div>
  );
}
