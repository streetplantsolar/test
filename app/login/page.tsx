import Link from "next/link";
import { login } from "@/lib/actions";
import { Flash } from "@/components/flash";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <h1>Welcome back</h1>
      <Flash error={error} />
      <form action={login}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required />

        <p style={{ marginTop: "1.2rem" }}>
          <button type="submit">Sign in</button>
        </p>
      </form>
      <p className="small muted">
        New here? <Link href="/join">Join Comn.one</Link> · Forgot your password?{" "}
        <Link href="/forgot">Reset it</Link>.
      </p>
    </>
  );
}
