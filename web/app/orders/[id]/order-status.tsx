"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL, money, type Order } from "@/lib/api";

/**
 * After paying, Stripe redirects here before (or after) its webhook arrives, so a PENDING order
 * is polled for a little while until the webhook confirms it.
 */
export function OrderStatus({ initial }: { initial: Order }) {
  const [order, setOrder] = useState(initial);

  useEffect(() => {
    if (order.status !== "PENDING") return;
    const timer = setInterval(async () => {
      const res = await fetch(`${API_URL}/orders/${order.id}`);
      if (res.ok) setOrder(await res.json());
    }, 1500);
    return () => clearInterval(timer);
  }, [order.id, order.status]);

  const heading = { PENDING: "Waiting for payment confirmation…", PAID: "Thank you! Your order is confirmed", CANCELLED: "This order was cancelled" }[order.status];
  return (
    <section>
      <h1 data-status={order.status}>{heading}</h1>
      <p className="muted">Order {order.id.slice(0, 8)} · receipt to {order.email}</p>
      <table className="cart">
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.slug}>
              <td>{l.quantity} × {l.name}</td>
              <td className="num">{money(l.unitPriceCents * l.quantity, order.currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td>Total</td><td className="num">{money(order.totalCents, order.currency)}</td></tr>
        </tfoot>
      </table>
      {order.status === "CANCELLED" && <p>No payment was taken and the items went back on the shelf.</p>}
      <p><Link href="/">Back to the shop</Link></p>
    </section>
  );
}
