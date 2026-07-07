import Link from "next/link";
import type { ShelfItem } from "@/lib/queries";
import { categoryLabel } from "@/lib/types";

export function statusChip(loanStatus: string | null, archived?: number) {
  if (archived) return <span className="chip">Shelved</span>;
  if (!loanStatus) return <span className="chip status-free">On the shelf</span>;
  if (loanStatus === "requested") return <span className="chip status-busy">Requested</span>;
  if (loanStatus === "reserved") return <span className="chip status-busy">Reserved</span>;
  return <span className="chip status-out">Out with a friend</span>;
}

export function ItemCard({ item, showOwner = true }: { item: ShelfItem; showOwner?: boolean }) {
  return (
    <div className="card">
      <p style={{ margin: "0 0 0.4rem" }}>
        <span className="chip">{categoryLabel(item.category)}</span>{" "}
        {statusChip(item.loan_status, item.archived)}
      </p>
      <h3>
        <Link href={`/items/${item.id}`}>{item.title}</Link>
      </h3>
      {showOwner && (
        <p className="byline">
          from <Link href={`/u/${item.owner_username}`}>{item.owner_name}</Link>
        </p>
      )}
      {item.description && <p className="desc">{item.description}</p>}
      <p className="small muted" style={{ margin: 0 }}>
        {item.lend_days ? `Lends for up to ${item.lend_days} days` : "Flexible return"}
      </p>
    </div>
  );
}
