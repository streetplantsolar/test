import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export default async function Landing() {
  const user = await currentUser();
  if (user) redirect("/home");

  return (
    <>
      <section className="hero">
        <h1>Your friends already own everything you need.</h1>
        <p className="lede">
          Comn.one (say it out loud: <em>common</em>) is a shared shelf for people who already
          trust each other. Put up the books, tools, games, and gear you&rsquo;re happy to lend.
          Borrow what your friends have. Return it when you&rsquo;re done. That&rsquo;s the whole
          app.
        </p>
        <p>
          <Link href="/join" className="btn">
            Start a shelf with your friends
          </Link>{" "}
          <Link href="/login" className="btn quiet">
            Sign in
          </Link>
        </p>
      </section>

      <div className="principles">
        <p>Most things spend most of their life sitting in a closet.</p>
        <p>Trust is the infrastructure. The app is just a shelf and a reminder.</p>
        <p>No middleman profits from your generosity. No ads, no fees on lending, ever.</p>
        <p>&ldquo;We own things together,&rdquo; not &ldquo;I monetize my stuff.&rdquo;</p>
      </div>

      <h2>How it works</h2>
      <ol className="steps">
        <li>
          <strong>Gather your people.</strong> Add friends one by one, or make a crew — your book
          club, your street, your D&amp;D group — with a single invite code.
        </li>
        <li>
          <strong>Shelve what you&rsquo;d lend.</strong> A drill, a dutch oven, a favorite novel.
          Set a return window (say, 30 days) or leave it flexible.
        </li>
        <li>
          <strong>Borrow, enjoy, return.</strong> Friends reserve with a tap, you hand it over in
          person, and gentle reminders make sure things find their way home.
        </li>
        <li>
          <strong>Open up to neighbors, if you like.</strong> Join a neighborhood or city circle
          and choose, item by item, whether neighbors can borrow too. Friends-only is always the
          default.
        </li>
      </ol>

      <h2>Free, and staying that way</h2>
      <p>
        Everything you need to share — shelves, friends, circles, reservations, reminders — is
        free, with no ads and no data games. If Comn.one ever earns money, it&rsquo;ll be from
        people who <em>choose</em> to chip in, never from gating the commons.{" "}
        <Link href="/support">Read how we think about money.</Link>
      </p>

      <footer className="footer">
        <p>
          Comn.one — a small tool for a very old idea. <Link href="/support">Support it</Link> if
          it serves you.
        </p>
      </footer>
    </>
  );
}
