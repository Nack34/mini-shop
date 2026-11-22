import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrdersService } from "../src/orders/orders.service.js";
import { createTestApp } from "./app.js";

let app: INestApplication;
let http: () => ReturnType<typeof request>;

beforeAll(async () => {
  app = await createTestApp();
  http = () => request(app.getHttpServer());
});
afterAll(() => app.close());

const stock = async (slug: string) => (await http().get(`/products/${slug}`)).body.stock as number;
const checkout = (items: { slug: string; quantity: number }[], email = "ana@example.com") =>
  http().post("/checkout").send({ email, items });

describe("catalog", () => {
  it("lists the seeded products with prices in cents", async () => {
    const res = await http().get("/products");
    expect(res.body).toHaveLength(6);
    expect(res.body.find((p: { slug: string }) => p.slug === "yerba-1kg")).toMatchObject({ priceCents: 900, stock: 50 });
  });

  it("serves a product, its generated image, and 404s", async () => {
    expect((await http().get("/products/termo-1l")).body.name).toBe("Steel thermos 1 L");
    const image = await http().get("/products/termo-1l/image.svg");
    expect(image.headers["content-type"]).toContain("image/svg+xml");
    expect((await http().get("/products/nope")).status).toBe(404);
  });

  it("generates valid SVG even for names with symbols", async () => {
    const res = await http().get("/products/yerbera-set/image.svg").buffer(true);
    const svg = Buffer.isBuffer(res.body) ? res.body.toString() : res.text;
    expect(svg).toContain(">YS</text>"); // "Yerba & sugar…" → YS, no raw "&"
    expect(svg).not.toMatch(/&(?!amp;|lt;|gt;)/);
  });
});

describe("checkout", () => {
  it("prices the order on the server, merges duplicate lines and reserves stock", async () => {
    const before = await stock("bombilla-pico-loro");
    const res = await checkout([
      { slug: "bombilla-pico-loro", quantity: 1 },
      { slug: "yerba-1kg", quantity: 2 },
      { slug: "bombilla-pico-loro", quantity: 1 },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.checkoutUrl).toBe(`http://shop.test/checkout/fake?order=${res.body.orderId}`);
    const order = (await http().get(`/orders/${res.body.orderId}`)).body;
    expect(order).toMatchObject({ status: "PENDING", totalCents: 2 * 1800 + 2 * 900, currency: "usd" });
    expect(order.lines).toHaveLength(2);
    expect(order).not.toHaveProperty("paymentRef");
    expect(await stock("bombilla-pico-loro")).toBe(before - 2);
  });

  it("ignores nothing from the client: a price field is rejected outright", async () => {
    const res = await http()
      .post("/checkout")
      .send({ email: "a@b.com", items: [{ slug: "yerba-1kg", quantity: 1, priceCents: 1 }] });
    expect(res.status).toBe(400);
  });

  it("validates the cart", async () => {
    expect((await checkout([])).status).toBe(400);
    expect((await checkout([{ slug: "yerba-1kg", quantity: 0 }])).status).toBe(400);
    expect((await checkout([{ slug: "yerba-1kg", quantity: 1 }], "not-an-email")).status).toBe(400);
    const unknown = await checkout([{ slug: "ghost", quantity: 1 }]);
    expect(unknown.status).toBe(400);
    expect(unknown.body.message).toContain("ghost");
  });

  it("refuses more than the stock and reserves nothing for that order", async () => {
    const yerba = await stock("yerba-1kg");
    const res = await checkout([{ slug: "yerba-1kg", quantity: 1 }, { slug: "termo-1l", quantity: 5 }]);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Only 3 left of "Steel thermos 1 L"');
    expect(await stock("yerba-1kg")).toBe(yerba); // the transaction rolled back the yerba too
  });

  it("sells the last unit exactly once when two shoppers race for it", async () => {
    const [a, b] = await Promise.all([
      checkout([{ slug: "edicion-limitada", quantity: 1 }], "first@example.com"),
      checkout([{ slug: "edicion-limitada", quantity: 1 }], "second@example.com"),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await stock("edicion-limitada")).toBe(0);
  });
});

describe("payment outcome (fake provider)", () => {
  it("paying confirms the order; repeating it changes nothing", async () => {
    const { orderId } = (await checkout([{ slug: "mate-imperial", quantity: 1 }])).body;
    expect((await http().post(`/payments/fake/${orderId}/pay`)).body).toEqual({ ok: true });
    expect((await http().post(`/payments/fake/${orderId}/pay`)).body).toEqual({ ok: false });
    const order = (await http().get(`/orders/${orderId}`)).body;
    expect(order.status).toBe("PAID");
    expect(order.paidAt).toBeTruthy();
    // A paid order can't be cancelled (its stock must not come back).
    expect((await http().post(`/payments/fake/${orderId}/cancel`)).body).toEqual({ ok: false });
  });

  it("cancelling gives the reserved stock back", async () => {
    const before = await stock("yerbera-set");
    const { orderId } = (await checkout([{ slug: "yerbera-set", quantity: 3 }])).body;
    expect(await stock("yerbera-set")).toBe(before - 3);
    await http().post(`/payments/fake/${orderId}/cancel`).expect(200);
    expect(await stock("yerbera-set")).toBe(before);
    expect((await http().get(`/orders/${orderId}`)).body.status).toBe("CANCELLED");
  });

  it("abandoned orders expire and release their stock", async () => {
    const before = await stock("yerbera-set");
    const { orderId } = (await checkout([{ slug: "yerbera-set", quantity: 2 }])).body;
    const orders = app.get(OrdersService);
    expect(await orders.expireStale(new Date())).toBe(0); // not yet
    expect(await orders.expireStale(new Date(Date.now() + 31 * 60_000))).toBeGreaterThanOrEqual(1);
    expect(await stock("yerbera-set")).toBe(before);
    expect((await http().get(`/orders/${orderId}`)).body.status).toBe("CANCELLED");
  });

  it("the Stripe webhook is closed when Stripe isn't configured, and order ids must be UUIDs", async () => {
    expect((await http().post("/webhooks/stripe").send({})).status).toBe(403);
    expect((await http().get("/orders/123")).status).toBe(400);
  });
});
