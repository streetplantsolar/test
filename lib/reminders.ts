import { db, now, uid } from "./db";

const DAY = 24 * 60 * 60 * 1000;

interface DueLoan {
  id: string;
  item_id: string;
  borrower_id: string;
  due_at: number;
  reminded_stage: number;
  title: string;
  owner_id: string;
}

function notifyRow(userId: string, body: string, href: string) {
  db.prepare(
    "INSERT INTO notifications (id, user_id, body, href, read, created_at) VALUES (?, ?, ?, ?, 0, ?)"
  ).run(uid(), userId, body, href, now());
}

/**
 * Lazy reminder sweep: runs at most once a minute, on any authenticated
 * request. Sends staged in-app reminders for open loans with a due date.
 * In production you'd also run this from a real scheduler (cron) and pair
 * it with email — see README.
 */
export function sweepReminders(): void {
  const g = globalThis as unknown as { __comnLastSweep?: number };
  const t = now();
  if (g.__comnLastSweep && t - g.__comnLastSweep < 60_000) return;
  g.__comnLastSweep = t;

  const loans = db
    .prepare(
      `SELECT l.id, l.item_id, l.borrower_id, l.due_at, l.reminded_stage,
              i.title, i.owner_id
       FROM loans l JOIN items i ON i.id = l.item_id
       WHERE l.status = 'out' AND l.due_at IS NOT NULL AND l.reminded_stage < 3`
    )
    .all() as unknown as DueLoan[];

  for (const loan of loans) {
    const daysLeft = Math.floor((loan.due_at - t) / DAY);
    let stage = 0;
    if (daysLeft < 0) stage = 3;
    else if (daysLeft === 0) stage = 2;
    else if (daysLeft <= 3) stage = 1;
    if (stage <= loan.reminded_stage) continue;

    const href = `/items/${loan.item_id}`;
    if (stage === 3) {
      notifyRow(
        loan.borrower_id,
        `“${loan.title}” is overdue — time to get it back to its owner.`,
        href
      );
      notifyRow(
        loan.owner_id,
        `“${loan.title}” is now overdue. A gentle nudge might help.`,
        href
      );
    } else if (stage === 2) {
      notifyRow(loan.borrower_id, `“${loan.title}” is due back today.`, href);
    } else {
      notifyRow(
        loan.borrower_id,
        `“${loan.title}” is due back in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
        href
      );
    }
    db.prepare("UPDATE loans SET reminded_stage = ? WHERE id = ?").run(stage, loan.id);
  }
}
