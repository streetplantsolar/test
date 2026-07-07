import Link from "next/link";
import { signup } from "@/lib/actions";
import { Flash } from "@/components/flash";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <h1>Join Comn.one</h1>
      <p className="muted">
        One account, your real name, the people you trust. No ads, no tracking, nothing to buy.
      </p>
      <Flash error={error} />
      <form action={signup}>
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" type="text" required placeholder="Sam Alvarez" />

        <label htmlFor="username">
          Username <span className="hint">— how friends find you, e.g. @sam</span>
        </label>
        <input id="username" name="username" type="text" required placeholder="sam" />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required placeholder="you@example.com" />

        <label htmlFor="password">
          Password <span className="hint">— at least 8 characters</span>
        </label>
        <input id="password" name="password" type="password" required minLength={8} />

        <label htmlFor="place">
          Neighborhood or city <span className="hint">— optional, helps friends recognize you</span>
        </label>
        <input id="place" name="place" type="text" placeholder="Ballard, Seattle" />

        <p style={{ marginTop: "1.2rem" }}>
          <button type="submit">Create my account</button>
        </p>
      </form>
      <p className="small muted">
        Already have one? <Link href="/login">Sign in</Link>.
      </p>
    </>
  );
}
