import { redirect } from "next/navigation";
import { db, now } from "@/lib/db";
import { resetPassword } from "@/lib/actions";
import { Flash } from "@/components/flash";

export default async function ResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const valid = db
    .prepare("SELECT 1 FROM password_resets WHERE token = ? AND expires_at > ?")
    .get(token, now());
  if (!valid) {
    redirect("/forgot?error=" + encodeURIComponent("That reset link expired or was already used — request a new one."));
  }

  return (
    <>
      <h1>Set a new password</h1>
      <Flash error={error} />
      <form action={resetPassword.bind(null, token)}>
        <label htmlFor="password">
          New password <span className="hint">— at least 8 characters</span>
        </label>
        <input id="password" name="password" type="password" required minLength={8} />
        <p style={{ marginTop: "1.2rem" }}>
          <button type="submit">Save and sign in</button>
        </p>
      </form>
    </>
  );
}
