"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { API_URL, errorMessage, money } from "@/lib/api";
import { subtotal } from "@/lib/cart";
import { useCart } from "../cart-context";

export default function CartPage() {
  const { lines, dispatch } = useCart();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checkout = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Only slugs and quantities: the API decides the prices.
        body: JSON.stringify({ email, items: lines.map(({ slug, quantity }) => ({ slug, quantity })) }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      const { checkoutUrl } = await res.json();
      dispatch({ type: "clear" });
      window.location.assign(checkoutUrl); // Stripe's hosted page (or the fake one)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the shop, please try again");
      setBusy(false);
    }
  };

  if (lines.length === 0) {
    return (
      <>
        <h1>Your cart</h1>
        <p>Your cart is empty. <Link href="/">Keep shopping</Link></p>
      </>
    );
  }

  return (
    <>
      <h1>Your cart</h1>
      <table className="cart">
        <thead>
          <tr><th>Product</th><th>Price</th><th>Quantity</th><th className="num">Total</th><th /></tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.slug}>
              <td>{l.name}</td>
              <td>{money(l.priceCents)}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={Math.min(20, l.stock)}
                  value={l.quantity}
                  aria-label={`Quantity of ${l.name}`}
                  onChange={(e) => dispatch({ type: "set", slug: l.slug, quantity: Number(e.target.value) })}
                />
              </td>
              <td className="num">{money(l.priceCents * l.quantity)}</td>
              <td><button className="link" onClick={() => dispatch({ type: "remove", slug: l.slug })}>Remove</button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3}>Subtotal</td><td className="num" data-testid="subtotal">{money(subtotal(lines))}</td><td /></tr>
        </tfoot>
      </table>
      <form className="checkout" onSubmit={checkout}>
        <label>
          Email for the receipt
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Redirecting to payment…" : "Checkout"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}
