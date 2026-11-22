export interface Settings {
  databaseUrl?: string;
  webUrl: string; // where Stripe sends the customer back
  stripe?: { secretKey: string; webhookSecret: string };
  currency: string;
}

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  return {
    databaseUrl: env.DATABASE_URL,
    webUrl: env.WEB_URL ?? "http://localhost:3000",
    // Without Stripe keys the shop uses a built-in fake checkout, so it runs with zero setup.
    stripe: env.STRIPE_SECRET_KEY
      ? { secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "" }
      : undefined,
    currency: env.CURRENCY ?? "usd",
  };
}

export const SETTINGS = Symbol("SETTINGS");
