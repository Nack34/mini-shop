import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CartBadge } from "./cart-badge";
import { CartProvider } from "./cart-context";
import "./globals.css";

export const metadata: Metadata = { title: "Mate & Co.", description: "A small demo shop: Next.js + NestJS + Stripe" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <header className="top">
            <Link href="/" className="brand">Mate &amp; Co.</Link>
            <CartBadge />
          </header>
          <main>{children}</main>
          <footer>Demo shop · payments in Stripe test mode, no real money</footer>
        </CartProvider>
      </body>
    </html>
  );
}
