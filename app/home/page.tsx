import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { feedItems, friendsOf, myBorrowing } from "@/lib/queries";
import { CATEGORIES } from "@/lib/types";
import { ItemCard } from "@/components/item-card";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const user = await requireUser();
  const { q = "", cat = "" } = await searchParams;
  const items = feedItems(user.id, q, cat);
  const borrowing = myBorrowing(user.id);
  const friendCount = friendsOf(user.id).length;

  return (
    <>
      <h1>Things you can borrow</h1>

      {borrowing.length > 0 && (
        <p className="notice good">
          You have {borrowing.length} loan{borrowing.length === 1 ? "" : "s"} in motion —{" "}
          <Link href="/loans">see where things stand</Link>.
        </p>
      )}

      <form method="get" action="/home" style={{ margin: "1rem 0" }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search titles and descriptions…"
          style={{ maxWidth: "20rem", marginRight: "0.5rem" }}
        />
        <select name="cat" defaultValue={cat} style={{ width: "auto", marginRight: "0.5rem" }}>
          <option value="">All categories</option>
          {CATEGORIES.map(([slug, label]) => (
            <option key={slug} value={slug}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="quiet">
          Filter
        </button>
      </form>

      {items.length === 0 ? (
        <div className="card" style={{ maxWidth: "34rem" }}>
          <h3>Nothing on the shared shelf yet</h3>
          {friendCount === 0 ? (
            <p>
              The shelf fills up as your people join. <Link href="/people">Add a friend or start
              a crew</Link>, then watch what appears here.
            </p>
          ) : (
            <p>
              Your friends haven&rsquo;t shelved anything yet — maybe{" "}
              <Link href="/shelf/new">put something up yourself</Link> to get things rolling.
            </p>
          )}
        </div>
      ) : (
        <div className="grid">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}
