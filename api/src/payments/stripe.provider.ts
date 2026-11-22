import Stripe from "stripe";
import type { Settings } from "../config.js";
import type { Order } from "../orders/order.entity.js";
import type { CheckoutSession, PaymentProvider } from "./provider.js";

export type PaymentEvent = { type: "paid" | "expired"; orderId: string; ref: string } | { type: "ignored"; eventType: string };

/** Stripe Checkout (hosted payment page). Card data never touches this server. */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";
  private readonly stripe: Stripe;

  constructor(private readonly settings: Settings, stripe?: Stripe) {
    this.stripe = stripe ?? new Stripe(settings.stripe!.secretKey);
  }

  async createCheckout(order: Order): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: order.email,
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        line_items: order.lines.map((line) => ({
          quantity: line.quantity,
          price_data: { currency: order.currency, unit_amount: line.unitPriceCents, product_data: { name: line.name } },
        })),
        // Same lifetime as the stock reservation.
        expires_at: Math.floor(order.expiresAt.getTime() / 1000),
        success_url: `${this.settings.webUrl}/orders/${order.id}?paid=1`,
        cancel_url: `${this.settings.webUrl}/cart`,
      },
      // Retrying the same order never creates a second session.
      { idempotencyKey: `checkout-${order.id}` },
    );
    return { url: session.url!, ref: session.id };
  }

  /**
   * Verifies the Stripe-Signature header (HMAC of the raw body + timestamp, 5-minute tolerance)
   * and maps the events the shop cares about. Anything unsigned or tampered with throws.
   */
  parseWebhook(rawBody: Buffer, signature: string): PaymentEvent {
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.settings.stripe!.webhookSecret);
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      if (session.payment_status !== "paid") return { type: "ignored", eventType: `${event.type} (${session.payment_status})` };
      return { type: "paid", orderId: session.metadata?.orderId ?? session.client_reference_id ?? "", ref: session.id };
    }
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      return { type: "expired", orderId: session.metadata?.orderId ?? session.client_reference_id ?? "", ref: session.id };
    }
    return { type: "ignored", eventType: event.type };
  }
}
