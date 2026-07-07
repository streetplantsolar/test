import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { myItems } from "@/lib/queries";
import { ItemCard } from "@/components/item-card";
import { Flash } from "@/components/flash";

export default async function ShelfPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const items = myItems(user.id);
  const active = items.filter((i) => !i.archived);
  const shelved = items.filter((i) => i.archived);

  return (
    <>
      <h1>My shelf</h1>
      <Flash error={error} />
      <p>
        <Link href="/shelf/new" className="btn">
          Put something up
        </Link>{" "}
        {user.supporter ? (
          <Link href="/shelf/scan" className="btn quiet">
            Scan a book barcode
          </Link>
        ) : (
          <Link href="/shelf/scan" className="btn quiet">
            Scan a barcode (supporter perk)
          </Link>
        )}
      </p>

      {active.length === 0 ? (
        <p className="muted">
          Nothing here yet. What do you own that mostly sits around? A ladder, a stand mixer, that
          novel everyone should read?
        </p>
      ) : (
        <div className="grid">
          {active.map((item) => (
            <ItemCard key={item.id} item={item} showOwner={false} />
          ))}
        </div>
      )}

      {shelved.length > 0 && (
        <details>
          <summary>Shelved away ({shelved.length})</summary>
          <div className="grid">
            {shelved.map((item) => (
              <ItemCard key={item.id} item={item} showOwner={false} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}
