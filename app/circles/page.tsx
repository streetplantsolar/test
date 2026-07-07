import { requireUser } from "@/lib/auth";
import { createCircle, joinCircle, leaveCircle } from "@/lib/actions";
import { browseCircles } from "@/lib/queries";
import { Flash } from "@/components/flash";

export default async function CirclesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string }>;
}) {
  const user = await requireUser();
  const { error, q = "" } = await searchParams;
  const circles = browseCircles(user.id, q);

  return (
    <>
      <h1>Neighborhood &amp; city circles</h1>
      <p className="muted">
        Circles widen the shelf beyond your friends — carefully. Joining one never exposes your
        items by itself: each item stays friends-only until you flip it to &ldquo;also
        neighbors&rdquo;.
      </p>
      <Flash error={error} />

      <form method="get" action="/circles" style={{ margin: "1rem 0" }}>
        <input type="text" name="q" defaultValue={q} placeholder="Search by name or area…" style={{ maxWidth: "18rem", marginRight: "0.5rem" }} />
        <button type="submit" className="quiet">
          Search
        </button>
      </form>

      {circles.length === 0 ? (
        <p className="muted">No circles found — maybe yours is the first.</p>
      ) : (
        <ul className="plain">
          {circles.map((c) => (
            <li key={c.id}>
              <span className="grow">
                <strong>{c.name}</strong> <span className="chip">{c.kind}</span>{" "}
                <span className="muted small">
                  {c.area && `${c.area} · `}
                  {c.member_count} member{c.member_count === 1 ? "" : "s"}
                </span>
                {c.description && <span className="small"> — {c.description}</span>}
              </span>
              {c.is_member ? (
                <form className="inline" action={leaveCircle.bind(null, c.id)}>
                  <button type="submit" className="quiet">
                    Leave
                  </button>
                </form>
              ) : (
                <form className="inline" action={joinCircle.bind(null, c.id)}>
                  <button type="submit">Join</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <fieldset>
        <legend>Start a circle</legend>
        <form action={createCircle}>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required placeholder="Wallingford Tool Shelf" />

          <label htmlFor="kind">Kind</label>
          <select id="kind" name="kind" defaultValue="neighborhood" style={{ width: "auto" }}>
            <option value="neighborhood">Neighborhood</option>
            <option value="city">City</option>
          </select>

          <label htmlFor="area">Area</label>
          <input id="area" name="area" type="text" placeholder="Wallingford, Seattle" />

          <label htmlFor="description">One-line description</label>
          <input id="description" name="description" type="text" placeholder="Tools and garden gear for the 98103." />

          <p style={{ marginTop: "1rem" }}>
            <button type="submit">Create circle</button>
          </p>
        </form>
      </fieldset>
    </>
  );
}
