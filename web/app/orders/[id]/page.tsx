import { notFound } from "next/navigation";
import { API_URL, type Order } from "@/lib/api";
import { OrderStatus } from "./order-status";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const res = await fetch(`${API_URL}/orders/${(await params).id}`, { cache: "no-store" });
  if (!res.ok) notFound();
  const order: Order = await res.json();
  return <OrderStatus initial={order} />;
}
