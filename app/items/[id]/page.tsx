import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  approveLoan,
  cancelLoan,
  declineLoan,
  markHandedOver,
  markReturned,
  requestLoan,
  toggleArchiveItem,
  updateItem,
} from "@/lib/actions";
import { activeLoanForItem, canViewItem, itemById, userById } from "@/lib/queries";
import { CATEGORIES, categoryLabel } from "@/lib/types";
import { statusChip } from "@/components/item-card";
import { Flash } from "@/components/flash";

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const item = itemById(id);
  if (!item || !canViewItem(user.id, item)) notFound();

  const loan = activeLoanForItem(id);
  const owner = userById(item.owner_id);
  const isOwner = item.owner_id === user.id;
  const isBorrower = loan?.borrower_id === user.id;

  return (
    <>
      <p style={{ marginBottom: 0 }}>
        <span className="chip">{categoryLabel(item.category)}</span>{" "}
        {statusChip(loan?.status ?? null, item.archived)}
      </p>
      <h1 style={{ marginTop: "0.4rem" }}>{item.title}</h1>
      {!isOwner && owner && (
        <p className="byline muted">
          from <Link href={`/u/${owner.username}`}>{owner.name}</Link>
        </p>
      )}
      {item.description && <p>{item.description}</p>}
      {item.care_notes && (
        <p className="small">
          <strong>Care notes:</strong> {item.care_notes}
        </p>
      )}
      <p className="small muted">
        {item.lend_days
          ? `Lends for up to ${item.lend_days} days — borrowers get reminders before it's due.`
          : "Flexible return — no set due date."}
        {" · "}
        {item.visibility === "neighbors"
          ? "Visible to friends, crews, and neighborhood/city circles."
          : "Visible to friends and crews only."}
      </p>

      <Flash error={error} />
      <hr />

      {/* ----- loan state & actions ----- */}

      {!loan && !isOwner && !item.archived && (
        <form action={requestLoan.bind(null, id)}>
          <h2 style={{ marginTop: 0 }}>Ask to borrow it</h2>
          <label htmlFor="message">
            A note for the owner <span className="hint">— optional: when you&rsquo;d pick it up, what it&rsquo;s for</span>
          </label>
          <textarea id="message" name="message" placeholder="Could I grab this Saturday? Returning it after the long weekend." />
          <p>
            <button type="submit">Request to borrow</button>
          </p>
        </form>
      )}

      {loan && (
        <div className="card" style={{ maxWidth: "34rem" }}>
          {loan.status === "requested" && (
            <>
              <h3>
                {isBorrower ? "You asked to borrow this" : `${loan.borrower_name} asked to borrow this`}
              </h3>
              {loan.message && <p className="small">&ldquo;{loan.message}&rdquo;</p>}
              {isOwner && (
                <div>
                  <form className="inline" action={approveLoan.bind(null, loan.id)}>
                    <button type="submit">Say yes</button>
                  </form>{" "}
                  <form className="inline" action={declineLoan.bind(null, loan.id)}>
                    <button type="submit" className="danger">
                      Not right now
                    </button>
                  </form>
                </div>
              )}
              {isBorrower && (
                <form action={cancelLoan.bind(null, loan.id)}>
                  <button type="submit" className="quiet">
                    Withdraw request
                  </button>
                </form>
              )}
            </>
          )}

          {loan.status === "reserved" && (
            <>
              <h3>Reserved for {isBorrower ? "you" : loan.borrower_name}</h3>
              <p className="small muted">
                Arrange the handoff however you two like — a doorstep, a coffee, a bike ride.
              </p>
              {isOwner && (
                <div>
                  <form className="inline" action={markHandedOver.bind(null, loan.id)}>
                    <button type="submit">I handed it over</button>
                  </form>{" "}
                  <form className="inline" action={declineLoan.bind(null, loan.id)}>
                    <button type="submit" className="danger">
                      Cancel reservation
                    </button>
                  </form>
                </div>
              )}
              {isBorrower && (
                <form action={cancelLoan.bind(null, loan.id)}>
                  <button type="submit" className="quiet">
                    Never mind, cancel
                  </button>
                </form>
              )}
            </>
          )}

          {loan.status === "out" && (
            <>
              <h3>Out with {isBorrower ? "you" : loan.borrower_name}</h3>
              <p className="small muted">
                {loan.due_at
                  ? `Due back by ${new Date(loan.due_at).toLocaleDateString()}. ${
                      isBorrower ? "You'll get reminders as it gets close." : ""
                    }`
                  : "No fixed due date — return it when it's done its job."}
              </p>
              {isOwner && (
                <form action={markReturned.bind(null, loan.id)}>
                  <button type="submit">It&rsquo;s back — mark returned</button>
                </form>
              )}
            </>
          )}
        </div>
      )}

      {/* ----- owner tools ----- */}

      {isOwner && (
        <>
          <details>
            <summary>Edit this item</summary>
            <form action={updateItem.bind(null, id)}>
              <label htmlFor="title">Title</label>
              <input id="title" name="title" type="text" required defaultValue={item.title} />

              <label htmlFor="category">Category</label>
              <select id="category" name="category" defaultValue={item.category} style={{ width: "auto" }}>
                {CATEGORIES.map(([slug, label]) => (
                  <option key={slug} value={slug}>
                    {label}
                  </option>
                ))}
              </select>

              <label htmlFor="description">Description</label>
              <textarea id="description" name="description" defaultValue={item.description} />

              <label htmlFor="care_notes">Care notes</label>
              <input id="care_notes" name="care_notes" type="text" defaultValue={item.care_notes} />

              <label htmlFor="lend_days">Return window in days (blank = flexible)</label>
              <input
                id="lend_days"
                name="lend_days"
                type="number"
                min={1}
                max={365}
                defaultValue={item.lend_days ?? ""}
                style={{ maxWidth: "8rem" }}
              />

              <label>Who can borrow it?</label>
              <p className="small" style={{ margin: "0.2rem 0" }}>
                <label style={{ display: "inline", fontWeight: 400 }}>
                  <input type="radio" name="visibility" value="friends" defaultChecked={item.visibility === "friends"} />{" "}
                  Friends &amp; crews only
                </label>
              </p>
              <p className="small" style={{ margin: "0.2rem 0" }}>
                <label style={{ display: "inline", fontWeight: 400 }}>
                  <input type="radio" name="visibility" value="neighbors" defaultChecked={item.visibility === "neighbors"} />{" "}
                  Also neighbors
                </label>
              </p>

              <p style={{ marginTop: "1rem" }}>
                <button type="submit">Save changes</button>
              </p>
            </form>
          </details>

          <form action={toggleArchiveItem.bind(null, id)}>
            <button type="submit" className="quiet">
              {item.archived ? "Put back on the shelf" : "Shelve away (hide from friends)"}
            </button>
          </form>
        </>
      )}
    </>
  );
}
