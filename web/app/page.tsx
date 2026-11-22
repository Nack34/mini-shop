import Link from "next/link";
import { getProducts, imageUrl, money } from "@/lib/api";
import { AddToCart } from "./add-to-cart";

export const dynamic = "force-dynamic"; // stock changes all the time

export default async function Home() {
  const products = await getProducts();
  return (
    <>
      <h1>Everything for your mate</h1>
      <ul className="grid">
        {products.map((p) => (
          <li key={p.slug} className="card">
            <Link href={`/products/${p.slug}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny generated SVGs */}
              <img src={imageUrl(p.slug)} alt="" width={400} height={300} />
              <h2>{p.name}</h2>
            </Link>
            <p className="price">{money(p.priceCents)}</p>
            <p className="stock">{p.stock === 0 ? "Sold out" : p.stock <= 3 ? `Only ${p.stock} left` : "In stock"}</p>
            <AddToCart product={p} />
          </li>
        ))}
      </ul>
    </>
  );
}
