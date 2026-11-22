import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("products")
export class Product {
  @PrimaryColumn()
  slug: string;

  @Column()
  name: string;

  @Column({ type: "text" })
  description: string;

  /** Minor units (cents): money is never a float. */
  @Column({ type: "integer" })
  priceCents: number;

  @Column({ type: "integer" })
  stock: number;

  /** Hex colour for the generated product image. */
  @Column()
  color: string;

  @Column()
  category: string;
}
