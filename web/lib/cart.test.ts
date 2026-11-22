import { describe, expect, it } from "vitest";
import { cartReducer, itemCount, subtotal, type CartLine } from "./cart";

const yerba = { slug: "yerba", name: "Yerba", priceCents: 900, stock: 50 };
const termo = { slug: "termo", name: "Termo", priceCents: 6200, stock: 3 };

describe("cart", () => {
  it("adds, merges lines and totals", () => {
    let cart: CartLine[] = [];
    cart = cartReducer(cart, { type: "add", product: yerba });
    cart = cartReducer(cart, { type: "add", product: yerba, quantity: 2 });
    cart = cartReducer(cart, { type: "add", product: termo });
    expect(cart.map((l) => [l.slug, l.quantity])).toEqual([["yerba", 3], ["termo", 1]]);
    expect(itemCount(cart)).toBe(4);
    expect(subtotal(cart)).toBe(3 * 900 + 6200);
  });

  it("never goes above the stock or the per-line limit", () => {
    let cart = cartReducer([], { type: "add", product: termo, quantity: 10 });
    expect(cart[0].quantity).toBe(3);
    cart = cartReducer([], { type: "add", product: yerba, quantity: 99 });
    expect(cart[0].quantity).toBe(20);
    cart = cartReducer(cart, { type: "set", slug: "yerba", quantity: 25 });
    expect(cart[0].quantity).toBe(20);
  });

  it("removes a line when its quantity drops to zero", () => {
    const cart = cartReducer([{ ...yerba, quantity: 2 }], { type: "set", slug: "yerba", quantity: 0 });
    expect(cart).toEqual([]);
  });

  it("ignores adding a sold-out product", () => {
    expect(cartReducer([], { type: "add", product: { ...termo, stock: 0 } })).toEqual([]);
  });
});
