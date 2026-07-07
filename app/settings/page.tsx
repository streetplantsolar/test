import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout, toggleSupporter, updateProfile } from "@/lib/actions";
import { Flash } from "@/components/flash";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const { error, saved } = await searchParams;

  return (
    <>
      <h1>Settings</h1>
      <Flash error={error} good={saved ? "Saved." : undefined} />

      <fieldset>
        <legend>Profile</legend>
        <form action={updateProfile}>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required defaultValue={user.name} />

          <label htmlFor="place">Neighborhood or city</label>
          <input id="place" name="place" type="text" defaultValue={user.place} />

          <label htmlFor="bio">
            A line about you <span className="hint">— shown to friends on your profile</span>
          </label>
          <input id="bio" name="bio" type="text" defaultValue={user.bio} />

          <p style={{ marginTop: "1rem" }}>
            <button type="submit">Save</button>
          </p>
        </form>
        <p className="small muted">
          Signed in as @{user.username} ({user.email}).
        </p>
      </fieldset>

      <fieldset>
        <legend>Supporter</legend>
        {user.supporter ? (
          <p>
            You&rsquo;re a supporter — thank you for keeping the commons open. Extras like{" "}
            <Link href="/shelf/scan">barcode scanning</Link> are yours.
          </p>
        ) : (
          <p>
            Supporters chip in $0.99/month and get small conveniences (like barcode scanning) as
            a thank-you. Nothing essential is ever behind it.{" "}
            <Link href="/support">Read more</Link>.
          </p>
        )}
        <form action={toggleSupporter}>
          <button type="submit" className="quiet">
            {user.supporter ? "Stop supporting (demo)" : "Become a supporter (demo)"}
          </button>
        </form>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Payments aren&rsquo;t wired up yet — this toggle is a stand-in so the supporter
          experience can be tried end to end.
        </p>
      </fieldset>

      <form action={logout}>
        <button type="submit" className="danger">
          Sign out
        </button>
      </form>
    </>
  );
}
