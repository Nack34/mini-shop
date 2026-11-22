"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { API_URL, money, type Order } from "@/lib/api";

/** Stands in for Stripe's hosted checkout when the API runs without Stripe keys. */
function FakeCheckout() {
  const id = useSearchParams().get("order") ?? "";
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/orders/${id}`).then(async (r) => r.ok && setOrder(await r.json()));
  }, [id]);

  const finish = async (outcome: "pay" | "cancel") => {
    await fetch(`${API_URL}/payments/fake/${id}/${outcome}`, { method: "POST" });
    router.push(outcome === "pay" ? `/orders/${id}?paid=1` : `/orders/${id}`);
  };

  if (!order) return <p>Loading…</p>;
  return (
    <section className="fake-pay">
      <p className="muted">Test payment page — the API has no Stripe keys configured.</p>
      <h1>Pay {money(order.totalCents, order.currency)}</h1>
      <ul>
        {order.lines.map((l) => (
          <li key={l.slug}>{l.quantity} × {l.name}</li>
        ))}
      </ul>
      <div className="row">
        <button onClick={() => finish("pay")}>Pay now</button>
        <button className="secondary" onClick={() => finish("cancel")}>Cancel payment</button>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <Suspense>
      <FakeCheckout />
    </Suspense>
  );
}
