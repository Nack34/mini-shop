import { expect, type Page, test } from "@playwright/test";

const API = "http://localhost:4000";
const card = (page: Page, name: string) => page.locator(".card").filter({ hasText: name });
const stockOf = async (page: Page, slug: string) => (await (await page.request.get(`${API}/products/${slug}`)).json()).stock as number;

test("browse, fill the cart, pay, and see the order confirmed", async ({ page }) => {
  const yerbaBefore = await stockOf(page, "yerba-1kg");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Everything for your mate" })).toBeVisible();

  // Two bags of yerba from the product page, one thermos from the list.
  await page.getByRole("link", { name: "Yerba mate 1 kg" }).click();
  await page.getByLabel("Quantity").fill("2");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: "Cart, 2 items" })).toBeVisible();
  await page.goto("/");
  await card(page, "Steel thermos 1 L").getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: "Cart, 3 items" })).toBeVisible();

  await page.getByRole("link", { name: /Cart/ }).click();
  await expect(page.getByTestId("subtotal")).toHaveText("$80.00"); // 2 × $9 + $62
  await page.getByLabel("Email for the receipt").fill("ana@example.com");
  await page.getByRole("button", { name: "Checkout" }).click();

  await expect(page.getByRole("heading", { name: "Pay $80.00" })).toBeVisible();
  expect(await stockOf(page, "yerba-1kg")).toBe(yerbaBefore - 2); // reserved while paying
  await page.getByRole("button", { name: "Pay now" }).click();

  await expect(page.getByRole("heading", { name: "Thank you! Your order is confirmed" })).toBeVisible();
  await expect(page.getByText("receipt to ana@example.com")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart, 0 items" })).toBeVisible(); // emptied after checkout
});

test("cancelling the payment puts the items back on the shelf", async ({ page }) => {
  const before = await stockOf(page, "yerbera-set");
  await page.goto("/products/yerbera-set");
  await page.getByLabel("Quantity").fill("3");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/cart");
  await page.getByLabel("Email for the receipt").fill("beto@example.com");
  await page.getByRole("button", { name: "Checkout" }).click();
  await page.getByRole("button", { name: "Cancel payment" }).click();
  await expect(page.getByRole("heading", { name: "This order was cancelled" })).toBeVisible();
  expect(await stockOf(page, "yerbera-set")).toBe(before);
});

test("someone else buys the last unit first: a clear error, nothing charged, cart kept", async ({ page }) => {
  await page.goto("/");
  await card(page, "Limited edition gourd").getByRole("button", { name: "Add to cart" }).click();
  await expect(card(page, "Limited edition gourd").getByRole("button", { name: "All in your cart" })).toBeDisabled();

  // Another customer checks out the only unit through the API.
  const other = await page.request.post(`${API}/checkout`, {
    data: { email: "fast@example.com", items: [{ slug: "edicion-limitada", quantity: 1 }] },
  });
  expect(other.status()).toBe(201);

  await page.goto("/cart");
  await page.getByLabel("Email for the receipt").fill("slow@example.com");
  await page.getByRole("button", { name: "Checkout" }).click();
  // (Next.js adds its own empty role=alert route announcer, hence the filter.)
  await expect(page.getByRole("alert").filter({ hasText: "sold out" })).toHaveText('"Limited edition gourd" just sold out');
  await expect(page.getByRole("cell", { name: "Limited edition gourd" })).toBeVisible();

  await page.goto("/");
  await expect(card(page, "Limited edition gourd").getByText("Sold out").first()).toBeVisible();
});

test("the cart survives a reload and can be emptied", async ({ page }) => {
  await page.goto("/");
  await card(page, "Wireless").or(card(page, "Pico de loro bombilla")).first().getByRole("button", { name: "Add to cart" }).click();
  await page.reload();
  await expect(page.getByRole("link", { name: "Cart, 1 items" })).toBeVisible();
  await page.goto("/cart");
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
});
