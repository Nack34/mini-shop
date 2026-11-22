/** Server components call the API directly (API_URL); the browser uses the public URL. */
export const API_URL =
  typeof window === "undefined"
    ? (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");

export interface Product {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  color: string;
  category: string;
}

export interface Order {
  id: string;
  email: string;
  status: "PENDING" | "PAID" | "CANCELLED";
  lines: { slug: string; name: string; quantity: number; unitPriceCents: number }[];
  totalCents: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
}

export const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

export const imageUrl = (slug: string) => `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/products/${slug}/image.svg`;

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load products");
  return res.json();
}

export async function getProduct(slug: string): Promise<Product | null> {
  const res = await fetch(`${API_URL}/products/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Could not load product");
  return res.json();
}

/** Turns an API error body into a sentence for the user. */
export async function errorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
  return message ?? "Something went wrong, please try again";
}
