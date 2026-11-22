import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, imageUrl, money } from "@/lib/api";
import { AddToCart } from "../../add-to-cart";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  return (
    <article className="detail">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl(product.slug)} alt="" width={400} height={300} />
      <div>
        <p className="muted"><Link href="/">← All products</Link> · {product.category}</p>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <p className="price">{money(product.priceCents)}</p>
        <p className="stock">{product.stock === 0 ? "Sold out" : `${product.stock} in stock`}</p>
        <AddToCart product={product} withQuantity />
      </div>
    </article>
  );
}
