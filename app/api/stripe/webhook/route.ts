import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe, stripeEnabled } from "@/lib/stripe";

// Stripe webhook: the single source of truth for who is a supporter.
// Point a webhook endpoint at POST /api/stripe/webhook with the events
//   checkout.session.completed
//   customer.subscription.updated
//   customer.subscription.deleted
// and set STRIPE_WEBHOOK_SECRET to the endpoint's signing secret.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeEnabled() || !secret) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.comn_user_id;
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (userId) {
      db.prepare(
        "UPDATE users SET supporter = 1, stripe_subscription_id = ? WHERE id = ?"
      ).run(subscriptionId ?? null, userId);
    }
  } else if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const active = event.type !== "customer.subscription.deleted" &&
      (sub.status === "active" || sub.status === "trialing");
    db.prepare(
      "UPDATE users SET supporter = ?, stripe_subscription_id = ? WHERE stripe_customer_id = ?"
    ).run(active ? 1 : 0, active ? sub.id : null, customerId);
  }

  return NextResponse.json({ received: true });
}
