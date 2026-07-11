import Stripe from "stripe";

// Stripe wiring, configured entirely by environment:
//
//   STRIPE_SECRET_KEY     sk_live_... / sk_test_...
//   STRIPE_PRICE_ID       price_...   (the $0.99/month recurring price)
//   STRIPE_WEBHOOK_SECRET whsec_...   (from the webhook endpoint you create)
//   STRIPE_PAYMENT_LINK   https://buy.stripe.com/...  (optional: the
//                         pay-what-you-want tip link shown on /support)
//
// When STRIPE_SECRET_KEY or STRIPE_PRICE_ID is missing, the app falls back
// to the demo supporter toggle in Settings, so nothing breaks in dev.

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export function paymentLink(): string | null {
  return process.env.STRIPE_PAYMENT_LINK || null;
}

const g = globalThis as unknown as { __comnStripe?: Stripe };

export function getStripe(): Stripe {
  return (g.__comnStripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!));
}
