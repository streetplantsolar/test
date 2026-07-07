import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  createCircle,
  joinByInviteCode,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from "@/lib/actions";
import { circlesOf, friendsOf, incomingRequests, outgoingRequests } from "@/lib/queries";
import { Flash } from "@/components/flash";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const friends = friendsOf(user.id);
  const incoming = incomingRequests(user.id);
  const outgoing = outgoingRequests(user.id);
  const crews = circlesOf(user.id, ["crew"]);

  return (
    <>
      <h1>People</h1>
      <p className="muted">
        Sharing starts with people you already trust. Add friends one at a time, or gather a whole
        group into a crew with one invite code.
      </p>
      <Flash error={error} />

      <fieldset>
        <legend>Add a friend</legend>
        <form action={sendFriendRequest}>
          <label htmlFor="username">Their username</label>
          <input id="username" name="username" type="text" required placeholder="@sam" style={{ maxWidth: "14rem", marginRight: "0.5rem" }} />
          <button type="submit">Send request</button>
        </form>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Not here yet? Tell them to join at comn.one — it takes a minute and costs nothing.
        </p>
      </fieldset>

      {incoming.length > 0 && (
        <>
          <h2>Requests for you</h2>
          <ul className="plain">
            {incoming.map((f) => (
              <li key={f.friendship_id}>
                <span className="grow">
                  <Link href={`/u/${f.username}`}>{f.name}</Link>{" "}
                  <span className="muted small">@{f.username}{f.place ? ` · ${f.place}` : ""}</span>
                </span>
                <form className="inline" action={respondFriendRequest.bind(null, f.friendship_id, true)}>
                  <button type="submit">Accept</button>
                </form>
                <form className="inline" action={respondFriendRequest.bind(null, f.friendship_id, false)}>
                  <button type="submit" className="quiet">
                    Decline
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Friends ({friends.length})</h2>
      {friends.length === 0 ? (
        <p className="muted">No friends yet — the shelf is lonely without them.</p>
      ) : (
        <ul className="plain">
          {friends.map((f) => (
            <li key={f.friendship_id}>
              <span className="grow">
                <Link href={`/u/${f.username}`}>{f.name}</Link>{" "}
                <span className="muted small">@{f.username}{f.place ? ` · ${f.place}` : ""}</span>
              </span>
              <form className="inline" action={removeFriend.bind(null, f.friendship_id)}>
                <button type="submit" className="danger">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {outgoing.length > 0 && (
        <>
          <h3 className="muted">Waiting on</h3>
          <ul className="plain">
            {outgoing.map((f) => (
              <li key={f.friendship_id}>
                <span className="grow">
                  {f.name} <span className="muted small">@{f.username}</span>
                </span>
                <span className="chip">pending</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <hr />

      <h2>Crews</h2>
      <p className="muted small">
        A crew is a private group of friends — a book club, a street, a band. Everyone in a crew
        can see each other&rsquo;s shelves, no individual friend-adding needed.
      </p>
      {crews.length > 0 && (
        <ul className="plain">
          {crews.map((c) => (
            <li key={c.id}>
              <span className="grow">
                <strong>{c.name}</strong>{" "}
                <span className="muted small">
                  {c.member_count} member{c.member_count === 1 ? "" : "s"} · invite code:{" "}
                  <code>{c.invite_code}</code>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <fieldset>
        <legend>Start a crew</legend>
        <form action={createCircle}>
          <input type="hidden" name="kind" value="crew" />
          <label htmlFor="crew-name">Crew name</label>
          <input id="crew-name" name="name" type="text" required placeholder="Maple Street Neighbors" style={{ maxWidth: "18rem", marginRight: "0.5rem" }} />
          <button type="submit">Create</button>
          <p className="small muted" style={{ marginBottom: 0 }}>
            You&rsquo;ll get an invite code to pass around.
          </p>
        </form>
      </fieldset>

      <fieldset>
        <legend>Join a crew</legend>
        <form action={joinByInviteCode}>
          <label htmlFor="code">Invite code</label>
          <input id="code" name="code" type="text" required placeholder="a1b2c3d4" style={{ maxWidth: "10rem", marginRight: "0.5rem" }} />
          <button type="submit">Join</button>
        </form>
      </fieldset>
    </>
  );
}
