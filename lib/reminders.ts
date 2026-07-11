import { db, now, uid } from "./db";
import { appUrl, sendMail } from "./mail";

const DAY = 24 * 60 * 60 * 1000;

interface DueLoan {
  id: string;
  item_id: string;
  borrower_id: string;
  due_at: number;
  reminded_stage: number;
  title: string;
  owner_id: string;
  borrower_email: string;
  borrower_name: string;
  owner_email: string;
  owner_name: string;
}

function notifyRow(userId: string, body: string, href: string) {
  db.prepare(
    "INSERT INTO notifications (id, user_id, body, href, read, created_at) VALUES (?, ?, ?, ?, 0, ?)"
  ).run(uid(), userId, body, href, now());
}

function remind(loan: DueLoan, body: string, emailIntro: string) {
  const href = `/items/${loan.item_id}`;
  notifyRow(loan.borrower_id, body, href);
  sendMail(
    loan.borrower_email,
    `Comn.one: ${body}`,
    `Hi ${loan.borrower_name.split(" ")[0]},\n\n${emailIntro}\n\n` +
      `See the item and arrange the return here:\n${appUrl(href)}\n\n` +
      `— Comn.one, a shared shelf between friends`
  );
}

/**
 * Lazy reminder sweep: runs at most once a minute, on any authenticated
 * request. Sends staged reminders — in-app always, plus email when SMTP is
 * configured — for open loans with a due date. In production, also point a
 * real scheduler (cron + curl) at GET /api/cron/remind so reminders go out
 * even when nobody is browsing — see README.
 */
export function sweepReminders(): void {
  const g = globalThis as unknown as { __comnLastSweep?: number };
  const t = now();
  if (g.__comnLastSweep && t - g.__comnLastSweep < 60_000) return;
  g.__comnLastSweep = t;
  runReminderSweep(t);
}

/** The sweep itself, unthrottled — callable from the cron entrypoint. */
export function runReminderSweep(t: number = now()): number {
  const loans = db
    .prepare(
      `SELECT l.id, l.item_id, l.borrower_id, l.due_at, l.reminded_stage,
              i.title, i.owner_id,
              bu.email AS borrower_email, bu.name AS borrower_name,
              ou.email AS owner_email, ou.name AS owner_name
       FROM loans l
       JOIN items i ON i.id = l.item_id
       JOIN users bu ON bu.id = l.borrower_id
       JOIN users ou ON ou.id = i.owner_id
       WHERE l.status = 'out' AND l.due_at IS NOT NULL AND l.reminded_stage < 3`
    )
    .all() as unknown as DueLoan[];

  let sent = 0;
  for (const loan of loans) {
    const daysLeft = Math.floor((loan.due_at - t) / DAY);
    let stage = 0;
    if (daysLeft < 0) stage = 3;
    else if (daysLeft === 0) stage = 2;
    else if (daysLeft <= 3) stage = 1;
    if (stage <= loan.reminded_stage) continue;

    const dueDate = new Date(loan.due_at).toLocaleDateString();
    if (stage === 3) {
      remind(
        loan,
        `“${loan.title}” is overdue — time to get it back to its owner.`,
        `“${loan.title}” was due back to ${loan.owner_name} on ${dueDate}. Life happens — just get it home when you can, and let them know.`
      );
      notifyRow(
        loan.owner_id,
        `“${loan.title}” is now overdue. A gentle nudge might help.`,
        `/items/${loan.item_id}`
      );
      sendMail(
        loan.owner_email,
        `Comn.one: “${loan.title}” is overdue`,
        `Hi ${loan.owner_name.split(" ")[0]},\n\n“${loan.title}” was due back from ${loan.borrower_name} on ${dueDate}. ` +
          `They've been reminded too — a friendly nudge from you usually does the rest.\n\n${appUrl(`/items/${loan.item_id}`)}\n\n— Comn.one`
      );
    } else if (stage === 2) {
      remind(
        loan,
        `“${loan.title}” is due back today.`,
        `Today's the day “${loan.title}” heads home to ${loan.owner_name}.`
      );
    } else {
      remind(
        loan,
        `“${loan.title}” is due back in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
        `A heads-up: “${loan.title}” is due back to ${loan.owner_name} on ${dueDate}.`
      );
    }
    db.prepare("UPDATE loans SET reminded_stage = ? WHERE id = ?").run(stage, loan.id);
    sent++;
  }
  return sent;
}
