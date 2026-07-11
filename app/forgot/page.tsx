import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions";
import { Flash } from "@/components/flash";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  return (
    <>
      <h1>Forgot your password?</h1>
      <Flash
        error={error}
        good={
          sent
            ? "If that email has an account, a reset link is on its way. It works for one hour."
            : undefined
        }
      />
      <p className="muted">
        Tell us your email and we&rsquo;ll send a link to set a new one.
      </p>
      <form action={requestPasswordReset}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
        <p style={{ marginTop: "1.2rem" }}>
          <button type="submit">Send reset link</button>
        </p>
      </form>
      <p className="small muted">
        Remembered it after all? <Link href="/login">Sign in</Link>.
      </p>
    </>
  );
}
