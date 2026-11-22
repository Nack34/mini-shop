/** Cart logic as pure functions (tested without React). The server re-prices everything at checkout. */
export interface CartLine {
  slug: string;
  name: string;
  priceCents: number;
  quantity: number;
  stock: number;
}

export type CartAction =
  | { type: "add"; product: Omit<CartLine, "quantity">; quantity?: number }
  | { type: "set"; slug: string; quantity: number }
  | { type: "remove"; slug: string }
  | { type: "clear" }
  | { type: "load"; lines: CartLine[] };

export const MAX_PER_LINE = 20;

export function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case "add": {
      const limit = Math.min(MAX_PER_LINE, action.product.stock);
      const existing = lines.find((l) => l.slug === action.product.slug);
      const quantity = Math.min(limit, (existing?.quantity ?? 0) + (action.quantity ?? 1));
      if (quantity <= 0) return lines;
      return existing
        ? lines.map((l) => (l.slug === action.product.slug ? { ...l, ...action.product, quantity } : l))
        : [...lines, { ...action.product, quantity }];
    }
    case "set":
      if (action.quantity <= 0) return lines.filter((l) => l.slug !== action.slug);
      return lines.map((l) =>
        l.slug === action.slug ? { ...l, quantity: Math.min(action.quantity, MAX_PER_LINE, l.stock) } : l,
      );
    case "remove":
      return lines.filter((l) => l.slug !== action.slug);
    case "clear":
      return [];
    case "load":
      return action.lines;
  }
}

export const itemCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
export const subtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity * l.priceCents, 0);
