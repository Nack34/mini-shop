import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, In, LessThan, type EntityManager } from "typeorm";
import { Product } from "../catalog/product.entity.js";
import { SETTINGS, type Settings } from "../config.js";
import { PAYMENT_PROVIDER, type PaymentProvider } from "../payments/provider.js";
import { Order, type OrderLine } from "./order.entity.js";

export const RESERVATION_MINUTES = 30;

@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {}

  /**
   * Prices come from the database, never from the client. Stock is reserved atomically
   * (UPDATE … WHERE stock >= qty), so two shoppers can't both buy the last unit.
   */
  async checkout(email: string, items: { slug: string; quantity: number }[]) {
    const merged = new Map<string, number>();
    for (const item of items) merged.set(item.slug, (merged.get(item.slug) ?? 0) + item.quantity);

    const order = await this.db.transaction(async (tx) => {
      const products = await tx.findBy(Product, { slug: In([...merged.keys()]) });
      const missing = [...merged.keys()].filter((slug) => !products.some((p) => p.slug === slug));
      if (missing.length) throw new BadRequestException(`Unknown products: ${missing.join(", ")}`);

      const lines: OrderLine[] = [];
      for (const product of products) {
        const quantity = merged.get(product.slug)!;
        const reserved = await tx
          .createQueryBuilder()
          .update(Product)
          .set({ stock: () => `stock - ${quantity}` })
          .where("slug = :slug AND stock >= :quantity", { slug: product.slug, quantity })
          .execute();
        if (!reserved.affected) {
          throw new ConflictException(
            product.stock === 0 ? `"${product.name}" just sold out` : `Only ${product.stock} left of "${product.name}"`,
          );
        }
        lines.push({ slug: product.slug, name: product.name, quantity, unitPriceCents: product.priceCents });
      }
      return tx.save(
        tx.create(Order, {
          email: email.trim().toLowerCase(),
          lines,
          totalCents: lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0),
          currency: this.settings.currency,
          expiresAt: new Date(Date.now() + RESERVATION_MINUTES * 60_000),
        }),
      );
    });

    try {
      const session = await this.payments.createCheckout(order);
      order.paymentRef = session.ref;
      await this.db.getRepository(Order).save(order);
      return { orderId: order.id, checkoutUrl: session.url };
    } catch (error) {
      this.log.error(`Payment provider failed for order ${order.id}`, error as Error);
      await this.cancel(order.id); // give the stock back
      throw new BadGatewayException("Payment provider unavailable, please try again");
    }
  }

  async get(id: string) {
    const order = await this.db.getRepository(Order).findOneBy({ id });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  /** Idempotent: Stripe retries webhooks, so a second "paid" for the same order changes nothing. */
  async markPaid(id: string, ref: string): Promise<boolean> {
    const result = await this.db
      .getRepository(Order)
      .update({ id, status: "PENDING" }, { status: "PAID", paidAt: new Date(), paymentRef: ref });
    if (result.affected) this.log.log(`Order ${id} paid`);
    return Boolean(result.affected);
  }

  /** Cancels a still-pending order and returns its reserved stock. Idempotent as well. */
  async cancel(id: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const settled = await tx.update(Order, { id, status: "PENDING" }, { status: "CANCELLED" });
      if (!settled.affected) return false;
      await this.release(tx, (await tx.findOneByOrFail(Order, { id })).lines);
      return true;
    });
  }

  /** Safety net for lost webhooks and abandoned fake checkouts. */
  async expireStale(now = new Date()): Promise<number> {
    const stale = await this.db.getRepository(Order).findBy({ status: "PENDING", expiresAt: LessThan(now) });
    let count = 0;
    for (const order of stale) if (await this.cancel(order.id)) count++;
    return count;
  }

  private async release(tx: EntityManager, lines: OrderLine[]) {
    for (const line of lines) {
      await tx.increment(Product, { slug: line.slug }, "stock", line.quantity);
    }
  }
}
