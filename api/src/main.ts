import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configureApp } from "./bootstrap.js";

// rawBody: Stripe signs the exact bytes it sent, so the webhook needs them unparsed.
const app = configureApp(await NestFactory.create(AppModule, { rawBody: true }));
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 4000));
console.log(`API on http://localhost:${process.env.PORT ?? 4000} · docs at /docs`);
