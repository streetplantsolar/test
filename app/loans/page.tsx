import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loanHistory, myBorrowing, myLending, type LoanRow } from "@/lib/queries";
import { Flash } from "@/components/flash";

function loanLine(loan: LoanRow, perspective: "borrowing" | "lending") {
  const who =
    perspective === "borrowing" ? `from ${loan.owner_name}` : `to ${loan.borrower_name}`;
  let state = "";
  if (loan.status === "requested") state = "waiting for a yes";
  else if (loan.status === "reserved") state = "reserved — arrange the handoff";
  else if (loan.status === "out")
    state = loan.due_at
      ? `out, due ${new Date(loan.due_at).toLocaleDateString()}`
      : "out, flexible return";
  return (
    <li key={loan.id}>
      <span className="grow">
        <Link href={`/items/${loan.item_id}`}>{loan.title}</Link>{" "}
        <span className="muted small">{who}</span>
      </span>
      <span className="chip">{state}</span>
    </li>
  );
}

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const borrowing = myBorrowing(user.id);
  const lending = myLending(user.id);
  const history = loanHistory(user.id);

  return (
    <>
      <h1>Loans</h1>
      <Flash error={error} />

      <h2>Things I&rsquo;m borrowing</h2>
      {borrowing.length === 0 ? (
        <p className="muted">
          Nothing right now. <Link href="/home">See what&rsquo;s on the shared shelf.</Link>
        </p>
      ) : (
        <ul className="plain">{borrowing.map((l) => loanLine(l, "borrowing"))}</ul>
      )}

      <h2>Things I&rsquo;m lending</h2>
      {lending.length === 0 ? (
        <p className="muted">
          No open requests. When a friend asks for something of yours, it shows up here and in
          your inbox.
        </p>
      ) : (
        <ul className="plain">{lending.map((l) => loanLine(l, "lending"))}</ul>
      )}

      {history.length > 0 && (
        <details>
          <summary>Past loans ({history.length})</summary>
          <ul className="plain">
            {history.map((l) => (
              <li key={l.id}>
                <span className="grow">
                  <Link href={`/items/${l.item_id}`}>{l.title}</Link>{" "}
                  <span className="muted small">
                    {l.owner_id === user.id
                      ? `lent to ${l.borrower_name}`
                      : `borrowed from ${l.owner_name}`}
                  </span>
                </span>
                <span className="muted small">
                  returned {l.closed_at ? new Date(l.closed_at).toLocaleDateString() : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
