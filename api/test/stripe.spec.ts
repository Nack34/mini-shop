import type { INestApplication } from "@nestjs/common";
import Stripe from "stripe";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadSettings } from "../src/config.js";
import { PAYMENT_PROVIDER } from "../src/payments/provider.js";
import { StripeProvider } from "../src/payments/stripe.provider.js";
import { createTestApp } from "./app.js";

const WEBHOOK_SECRET = "whsec_test_secret";
const env = { STRIPE_SECRET_KEY: "sk_test_dummy", STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET };

// The real Stripe SDK, with only the network call to create a session stubbed out.
const stripe = new Stripe("sk_test_dummy");
const created: { params: Stripe.Checkout.SessionCreateParams; options: Stripe.RequestOptions }[] = [];
(stripe.checkout.sessions as any).create = async (params: Stripe.Checkout.SessionCreateParams, options: Stripe.RequestOptions) => {
  created.push({ params, options });
  return { id: `cs_test_${created.length}`, url: `https://checkout.stripe.com/c/pay/cs_test_${created.length}` };
};

let app: INestApplication;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  app = await createTestApp(env, (b) => b.overrideProvider(PAYMENT_PROVIDER).useValue(new StripeProvider(loadSettings({ ...process.env, ...env }), stripe)));
});
afterAll(() => app.close());

/** A webhook exactly as Stripe would send it, signed with the endpoint secret. */
function signedEvent(type: string, session: Record<string, unknown>, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify({ id: `evt_${Math.random()}`, object: "event", type, data: { object: { object: "checkout.session", ...session } } });
  return { payload, signature: stripe.webhooks.generateTestHeaderString({ payload, secret }) };
}

const post = (event: { payload: string; signature: string }) =>
  http().post("/webhooks/stripe").set("Content-Type", "application/json").set("Stripe-Signature", event.signature).send(event.payload);

describe("Stripe Checkout", () => {
  let orderId: string;

  it("creates a hosted checkout session with server-side prices and an idempotency key", async () => {
    const res = await http().post("/checkout").send({ email: "ana@example.com", items: [{ slug: "termo-1l", quantity: 2 }] });
    expect(res.status).toBe(201);
    orderId = res.body.orderId;
    expect(res.body.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
    const { params, options } = created[0];
    expect(params.line_items).toEqual([
      { quantity: 2, price_data: { currency: "usd", unit_amount: 6200, product_data: { name: "Steel thermos 1 L" } } },
    ]);
    expect(params.metadata).toEqual({ orderId });
    expect(params.success_url).toBe(`http://shop.test/orders/${orderId}?paid=1`);
    expect(options.idempotencyKey).toBe(`checkout-${orderId}`);
  });

  it("rejects unsigned, wrongly signed and tampered webhooks", async () => {
    const good = signedEvent("checkout.session.completed", { id: "cs_test_1", payment_status: "paid", metadata: { orderId } });
    expect((await http().post("/webhooks/stripe").set("Content-Type", "application/json").send(good.payload)).status).toBe(400);
    expect((await post(signedEvent("checkout.session.completed", { metadata: { orderId } }, "whsec_wrong"))).status).toBe(400);
    expect((await post({ payload: good.payload.replace("paid", "PAID"), signature: good.signature })).status).toBe(400);
    expect((await http().get(`/orders/${orderId}`)).body.status).toBe("PENDING");
  });

  it("marks the order paid on checkout.session.completed, once, even if Stripe retries", async () => {
    const event = signedEvent("checkout.session.completed", { id: "cs_test_1", payment_status: "paid", metadata: { orderId } });
    expect((await post(event)).body).toEqual({ received: true });
    expect((await post(event)).status).toBe(200); // retried delivery
    const order = (await http().get(`/orders/${orderId}`)).body;
    expect(order.status).toBe("PAID");
  });

  it("waits for delayed payment methods instead of trusting 'completed' blindly", async () => {
    const res = await http().post("/checkout").send({ email: "b@example.com", items: [{ slug: "yerba-1kg", quantity: 1 }] });
    const id = res.body.orderId;
    await post(signedEvent("checkout.session.completed", { id: "cs_x", payment_status: "unpaid", metadata: { orderId: id } }));
    expect((await http().get(`/orders/${id}`)).body.status).toBe("PENDING");
    await post(signedEvent("checkout.session.async_payment_succeeded", { id: "cs_x", payment_status: "paid", metadata: { orderId: id } }));
    expect((await http().get(`/orders/${id}`)).body.status).toBe("PAID");
  });

  it("releases the stock when the session expires", async () => {
    const before = (await http().get("/products/yerbera-set")).body.stock;
    const res = await http().post("/checkout").send({ email: "c@example.com", items: [{ slug: "yerbera-set", quantity: 4 }] });
    await post(signedEvent("checkout.session.expired", { id: "cs_y", metadata: { orderId: res.body.orderId } }));
    expect((await http().get("/products/yerbera-set")).body.stock).toBe(before);
    expect((await http().get(`/orders/${res.body.orderId}`)).body.status).toBe("CANCELLED");
  });

  it("acknowledges events it doesn't handle, and keeps the fake payment route closed", async () => {
    expect((await post(signedEvent("customer.created", {}))).status).toBe(200);
    expect((await http().post(`/payments/fake/00000000-0000-4000-8000-000000000000/pay`)).status).toBe(403);
  });

  it("gives the stock back if Stripe is down", async () => {
    (stripe.checkout.sessions as any).create = async () => {
      throw new Error("ECONNRESET");
    };
    const before = (await http().get("/products/mate-imperial")).body.stock;
    const res = await http().post("/checkout").send({ email: "d@example.com", items: [{ slug: "mate-imperial", quantity: 1 }] });
    expect(res.status).toBe(502);
    expect((await http().get("/products/mate-imperial")).body.stock).toBe(before);
  });
});
