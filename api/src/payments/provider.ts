import type { Order } from "../orders/order.entity.js";

export interface CheckoutSession {
  url: string;
  ref: string;
}

/** What the shop needs from a payment provider. Stripe in production, a fake one for demos and tests. */
export interface PaymentProvider {
  readonly name: "stripe" | "fake";
  createCheckout(order: Order): Promise<CheckoutSession>;
}

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");
