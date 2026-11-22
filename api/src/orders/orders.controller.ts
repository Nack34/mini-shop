import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  type RawBodyRequest,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsEmail, IsInt, IsString, Max, Min, ValidateNested } from "class-validator";
import type { Request } from "express";
import { PAYMENT_PROVIDER, type PaymentProvider } from "../payments/provider.js";
import type { StripeProvider } from "../payments/stripe.provider.js";
import { OrdersService } from "./orders.service.js";

class CartItemDto {
  @IsString()
  slug: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;
}

class CheckoutDto {
  @IsEmail()
  email: string;

  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items: CartItemDto[];
}

@ApiTags("orders")
@Controller()
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  @Post("checkout")
  checkout(@Body() body: CheckoutDto) {
    return this.orders.checkout(body.email, body.items);
  }

  /** Order ids are random UUIDs, so the confirmation page can be shared without an account. */
  @Get("orders/:id")
  async get(@Param("id", ParseUUIDPipe) id: string) {
    const { paymentRef: _ref, ...order } = await this.orders.get(id);
    return order;
  }

  @Post("webhooks/stripe")
  @HttpCode(200)
  async stripeWebhook(@Req() req: RawBodyRequest<Request>, @Headers("stripe-signature") signature?: string) {
    if (this.payments.name !== "stripe") throw new ForbiddenException("Stripe is not configured");
    let event;
    try {
      event = (this.payments as StripeProvider).parseWebhook(req.rawBody!, signature ?? "");
    } catch {
      throw new BadRequestException("Invalid signature"); // Stripe will retry; an attacker gets nothing
    }
    if (event.type === "paid") await this.orders.markPaid(event.orderId, event.ref);
    if (event.type === "expired") await this.orders.cancel(event.orderId);
    return { received: true };
  }

  /** Only exists with the fake provider: stands in for Stripe's hosted page in demos and E2E tests. */
  @Post("payments/fake/:id/:outcome")
  @HttpCode(200)
  async fakePayment(@Param("id", ParseUUIDPipe) id: string, @Param("outcome") outcome: string) {
    if (this.payments.name !== "fake") throw new ForbiddenException("Fake payments are disabled");
    if (outcome === "pay") return { ok: await this.orders.markPaid(id, `fake_${id}`) };
    if (outcome === "cancel") return { ok: await this.orders.cancel(id) };
    throw new BadRequestException("outcome must be pay or cancel");
  }
}
