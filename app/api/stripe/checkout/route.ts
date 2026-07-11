import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/mail";
import { getStripe, stripeEnabled } from "@/lib/stripe";

// Starts a $0.99/month supporter subscription via Stripe Checkout.
// The webhook (../webhook) flips the supporter flag when payment completes.
export async function POST(): Promise<NextResponse> {
  if (!stripeEnabled()) {
    return NextResponse.redirect(appUrl("/settings?error=Payments%20aren%27t%20configured%20yet."), 303);
  }
  const user = await currentUser();
  if (!user) return NextResponse.redirect(appUrl("/login"), 303);

  const stripe = getStripe();

  // Reuse the Stripe customer across subscribe/cancel/resubscribe.
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { comn_user_id: user.id },
    });
    customerId = customer.id;
    db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(customerId, user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: appUrl("/settings?upgraded=1"),
    cancel_url: appUrl("/support"),
    metadata: { comn_user_id: user.id },
  });

  return NextResponse.redirect(session.url!, 303);
}
