import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { itemsOfOwnerVisibleTo, userByUsername } from "@/lib/queries";
import { ItemCard } from "@/components/item-card";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const viewer = await requireUser();
  const { username } = await params;
  const person = userByUsername(username.toLowerCase());
  if (!person) notFound();

  const isMe = person.id === viewer.id;
  const items = isMe ? [] : itemsOfOwnerVisibleTo(viewer.id, person.id);

  return (
    <>
      <h1>{person.name}</h1>
      <p className="muted">
        @{person.username}
        {person.place && ` · ${person.place}`}
      </p>
      {person.bio && <p>{person.bio}</p>}

      {isMe ? (
        <p className="muted">
          This is you! Manage your things on <a href="/shelf">your shelf</a>.
        </p>
      ) : (
        <>
          <h2>On their shelf</h2>
          {items.length === 0 ? (
            <p className="muted">
              Nothing you can borrow from {person.name.split(" ")[0]} right now — either their
              shelf is empty or you two aren&rsquo;t connected yet.
            </p>
          ) : (
            <div className="grid">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} showOwner={false} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
