import "reflect-metadata";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";

/**
 * Boots the real AppModule (in-memory sql.js, or Postgres with TEST_DATABASE_URL).
 * `override` swaps the payment provider, e.g. Stripe with a stubbed network call.
 */
export async function createTestApp(env: Record<string, string | undefined> = {}, override?: (b: any) => any) {
  for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) delete process.env[key];
  Object.assign(process.env, { WEB_URL: "http://shop.test", ...env });
  if (process.env.TEST_DATABASE_URL) {
    Object.assign(process.env, { DATABASE_URL: process.env.TEST_DATABASE_URL, DB_SYNC: "true", DB_DROP_SCHEMA: "true" });
  }
  const { AppModule } = await import("../src/app.module.js");
  const { configureApp } = await import("../src/bootstrap.js");
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (override) builder = override(builder);
  const app: INestApplication = configureApp((await builder.compile()).createNestApplication({ rawBody: true }));
  await app.init();
  return app;
}
