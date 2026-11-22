import { Global, Inject, Module, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CatalogModule } from "./catalog/catalog.js";
import { Product } from "./catalog/product.entity.js";
import { loadSettings, SETTINGS, type Settings } from "./config.js";
import { Order } from "./orders/order.entity.js";
import { OrdersController } from "./orders/orders.controller.js";
import { OrdersService } from "./orders/orders.service.js";
import { FakeProvider } from "./payments/fake.provider.js";
import { PAYMENT_PROVIDER } from "./payments/provider.js";
import { StripeProvider } from "./payments/stripe.provider.js";

@Global()
@Module({
  providers: [
    { provide: SETTINGS, useFactory: () => loadSettings() },
    {
      provide: PAYMENT_PROVIDER,
      inject: [SETTINGS],
      useFactory: (s: Settings) => (s.stripe ? new StripeProvider(s) : new FakeProvider(s)),
    },
  ],
  exports: [SETTINGS, PAYMENT_PROVIDER],
})
class CoreModule {}

@Module({
  imports: [
    CoreModule,
    TypeOrmModule.forRootAsync({
      inject: [SETTINGS],
      useFactory: (s: Settings) =>
        s.databaseUrl
          ? {
              type: "postgres",
              url: s.databaseUrl,
              entities: [Product, Order],
              synchronize: process.env.DB_SYNC === "true",
              dropSchema: process.env.DB_DROP_SCHEMA === "true",
            }
          : { type: "sqljs", entities: [Product, Order], synchronize: true },
    }),
    CatalogModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class AppModule implements OnModuleInit, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;

  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  onModuleInit() {
    // Release stock held by orders nobody paid for.
    this.timer = setInterval(() => void this.orders.expireStale(), 60_000);
    this.timer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }
}
