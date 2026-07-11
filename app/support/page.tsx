import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { paymentLink, stripeEnabled } from "@/lib/stripe";

export default async function SupportPage() {
  const user = await currentUser();

  return (
    <>
      <h1>How Comn.one stays alive</h1>
      <p className="lede" style={{ maxWidth: "40rem" }}>
        This is a tool for lending things to people you love, so it would be a little absurd for
        a company to skim a percentage off the top. Here&rsquo;s the deal, in plain words.
      </p>

      <h2>What&rsquo;s always free</h2>
      <p style={{ maxWidth: "40rem" }}>
        Everything that makes sharing work: your shelf, unlimited items, friends and crews,
        neighborhood and city circles, reservations, borrowing, return reminders. No ads. No
        selling your data. No fees on any loan, ever. If we can&rsquo;t afford to run it that
        way, we&rsquo;ll shut it down before we&rsquo;ll ruin it.
      </p>

      <h2>Two honest ways to help</h2>
      <ul style={{ maxWidth: "40rem" }}>
        <li style={{ margin: "0.6rem 0" }}>
          <strong>Chip in what you want, when you want.</strong> Like a tip jar, or how Wikipedia
          does it. One-time, any amount, zero strings. This keeps the servers on.
        </li>
        <li style={{ margin: "0.6rem 0" }}>
          <strong>Become a supporter — $0.99/month.</strong> A thank-you tier for regulars. It
          buys small conveniences (barcode scanning to add books in seconds, more to come), never
          access. Think of it as buying the tool a coffee, and getting a slightly nicer handle on
          the hammer.
        </li>
      </ul>

      <div className="principles" style={{ maxWidth: "40rem" }}>
        <p>Paid features never gate core access.</p>
        <p>If a convenience turns out to be essential, it becomes free.</p>
        <p>Money flows to keeping the commons open — not to a middleman.</p>
      </div>

      {!stripeEnabled() && !paymentLink() && (
        <p className="notice" style={{ maxWidth: "40rem" }}>
          Payments aren&rsquo;t connected yet while Comn.one finds its feet. When they are,
          it&rsquo;ll be through a simple processor with public accounting of what running this
          costs.
        </p>
      )}

      <p>
        {paymentLink() && (
          <>
            <a href={paymentLink()!} className="btn">
              Chip in what you want
            </a>{" "}
          </>
        )}
        {user ? (
          stripeEnabled() && !user.supporter ? (
            <>
              <Link href="/settings" className="btn quiet">
                Become a supporter — $0.99/mo
              </Link>
            </>
          ) : (
            <Link href="/settings" className="btn quiet">
              Supporter settings
            </Link>
          )
        ) : (
          <Link href="/join" className="btn quiet">
            Join Comn.one
          </Link>
        )}
      </p>
    </>
  );
}
