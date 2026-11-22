import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export type OrderStatus = "PENDING" | "PAID" | "CANCELLED";

export interface OrderLine {
  slug: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

@Entity("orders")
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  email: string;

  @Column({ type: "varchar", default: "PENDING" })
  status: OrderStatus;

  /** Prices are copied at checkout time: later price changes don't rewrite history. */
  @Column({ type: "simple-json" })
  lines: OrderLine[];

  @Column({ type: "integer" })
  totalCents: number;

  @Column()
  currency: string;

  /** Stripe Checkout Session id (or the fake provider's reference). */
  @Column({ type: "varchar", nullable: true })
  paymentRef: string | null;

  /** Reserved stock is released if the order isn't paid by then. */
  @Column({ type: Date })
  expiresAt: Date;

  @Column({ type: Date, nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
