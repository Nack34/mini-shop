import type { Settings } from "../config.js";
import type { Order } from "../orders/order.entity.js";
import type { CheckoutSession, PaymentProvider } from "./provider.js";

/** Used when no Stripe key is configured: "pays" on a page of the shop itself. */
export class FakeProvider implements PaymentProvider {
  readonly name = "fake";

  constructor(private readonly settings: Settings) {}

  async createCheckout(order: Order): Promise<CheckoutSession> {
    return { url: `${this.settings.webUrl}/checkout/fake?order=${order.id}`, ref: `fake_${order.id}` };
  }
}
