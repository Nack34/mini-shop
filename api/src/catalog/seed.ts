import type { Product } from "./product.entity.js";

export const SEED: Product[] = [
  { slug: "mate-imperial", name: "Imperial gourd", description: "Calabash gourd with a hand-carved alpaca rim.", priceCents: 4500, stock: 12, color: "#8b5e3c", category: "mate" },
  { slug: "bombilla-pico-loro", name: "Pico de loro bombilla", description: "Stainless steel straw with a curved tip.", priceCents: 1800, stock: 30, color: "#9ca3af", category: "mate" },
  { slug: "yerba-1kg", name: "Yerba mate 1 kg", description: "Classic cut with stems, aged 12 months.", priceCents: 900, stock: 50, color: "#4d7c0f", category: "yerba" },
  { slug: "termo-1l", name: "Steel thermos 1 L", description: "Keeps water at 80 °C for 24 hours. Pouring spout for mate.", priceCents: 6200, stock: 3, color: "#1f2937", category: "accessories" },
  { slug: "yerbera-set", name: "Yerba & sugar canister set", description: "Two tin canisters with airtight lids.", priceCents: 2400, stock: 8, color: "#b45309", category: "accessories" },
  { slug: "edicion-limitada", name: "Limited edition gourd", description: "Signed by the artisan. Only one made.", priceCents: 15000, stock: 1, color: "#7c3aed", category: "mate" },
];
