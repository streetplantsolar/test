import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { appUrl } from "@/lib/mail";
import { getStripe, stripeEnabled } from "@/lib/stripe";

// Sends a supporter to the Stripe billing portal to update their card or
// cancel — cancellation flows back through the webhook automatically.
export async function POST(): Promise<NextResponse> {
  if (!stripeEnabled()) return NextResponse.redirect(appUrl("/settings"), 303);
  const user = await currentUser();
  if (!user) return NextResponse.redirect(appUrl("/login"), 303);
  if (!user.stripe_customer_id) return NextResponse.redirect(appUrl("/settings"), 303);

  const session = await getStripe().billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: appUrl("/settings"),
  });
  return NextResponse.redirect(session.url, 303);
}
