"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, newInviteCode, now, uid } from "./db";
import { endSession, hashPassword, requireUser, startSession, verifyPassword } from "./auth";
import { appUrl, sendMail } from "./mail";
import {
  activeLoanForItem,
  circleById,
  isCircleMember,
  itemById,
  loanById,
  notify,
  userByUsername,
} from "./queries";
import type { User } from "./types";

const DAY = 24 * 60 * 60 * 1000;

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function refresh(): void {
  revalidatePath("/", "layout");
}

/* ---------- account ---------- */

export async function signup(form: FormData): Promise<void> {
  const name = str(form, "name");
  const email = str(form, "email").toLowerCase();
  const username = str(form, "username").toLowerCase();
  const password = form.get("password");
  const place = str(form, "place");

  if (!name) fail("/join", "Please tell us your name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("/join", "That email doesn't look right.");
  if (!/^[a-z0-9_-]{3,20}$/.test(username))
    fail("/join", "Usernames are 3–20 characters: letters, numbers, - or _.");
  if (typeof password !== "string" || password.length < 8)
    fail("/join", "Passwords need at least 8 characters.");

  const id = uid();
  try {
    db.prepare(
      `INSERT INTO users (id, email, username, name, password_hash, place, bio, supporter, created_at)
       VALUES (?, ?, ?, ?, ?, ?, '', 0, ?)`
    ).run(id, email, username, name, hashPassword(password), place, now());
  } catch {
    fail("/join", "That email or username is already taken.");
  }
  await startSession(id);
  redirect("/home");
}

export async function login(form: FormData): Promise<void> {
  const email = str(form, "email").toLowerCase();
  const password = form.get("password");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
    | unknown as User
    | undefined;
  if (!user || typeof password !== "string" || !verifyPassword(password, user.password_hash)) {
    fail("/login", "Email and password don't match.");
  }
  await startSession(user.id);
  redirect("/home");
}

export async function requestPasswordReset(form: FormData): Promise<void> {
  const email = str(form, "email").toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
    | unknown as User
    | undefined;
  // Always respond identically whether or not the account exists, so this
  // form can't be used to probe which emails are registered.
  if (user) {
    const token = uid() + uid().replace(/-/g, "");
    db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(user.id);
    db.prepare(
      "INSERT INTO password_resets (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
    ).run(token, user.id, now() + 60 * 60 * 1000, now()); // valid 1 hour
    const link = appUrl(`/reset/${token}`);
    sendMail(
      user.email,
      "Reset your Comn.one password",
      `Hi ${user.name.split(" ")[0]},\n\nSomeone (hopefully you) asked to reset the password for @${user.username}. ` +
        `This link works for one hour:\n\n${link}\n\nIf it wasn't you, ignore this — nothing changes.\n\n— Comn.one`
    );
  }
  redirect("/forgot?sent=1");
}

export async function resetPassword(token: string, form: FormData): Promise<void> {
  const row = db
    .prepare("SELECT * FROM password_resets WHERE token = ? AND expires_at > ?")
    .get(token, now()) as unknown as { user_id: string } | undefined;
  if (!row) fail("/forgot", "That reset link expired or was already used — request a new one.");
  const password = form.get("password");
  if (typeof password !== "string" || password.length < 8)
    fail(`/reset/${token}`, "Passwords need at least 8 characters.");
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    hashPassword(password),
    row.user_id
  );
  db.prepare("DELETE FROM password_resets WHERE token = ?").run(token);
  // Sign out every existing session for safety, then start a fresh one.
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.user_id);
  await startSession(row.user_id);
  redirect("/home");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/");
}

export async function updateProfile(form: FormData): Promise<void> {
  const user = await requireUser();
  const name = str(form, "name");
  if (!name) fail("/settings", "Your name can't be empty.");
  db.prepare("UPDATE users SET name = ?, place = ?, bio = ? WHERE id = ?").run(
    name,
    str(form, "place"),
    str(form, "bio"),
    user.id
  );
  refresh();
  redirect("/settings?saved=1");
}

// Demo-only stand-in for a real checkout: flips the supporter flag so the
// supporter experience can be tried end to end. See README for wiring Stripe.
export async function toggleSupporter(): Promise<void> {
  const user = await requireUser();
  db.prepare("UPDATE users SET supporter = ? WHERE id = ?").run(user.supporter ? 0 : 1, user.id);
  refresh();
  redirect("/settings");
}

/* ---------- items ---------- */

export async function addItem(form: FormData): Promise<void> {
  const user = await requireUser();
  const title = str(form, "title");
  if (!title) fail("/shelf/new", "Every item needs a title.");
  const lendDaysRaw = str(form, "lend_days");
  const lendDays = lendDaysRaw ? Math.max(1, Math.min(365, parseInt(lendDaysRaw, 10) || 0)) : null;
  const visibility = str(form, "visibility") === "neighbors" ? "neighbors" : "friends";
  db.prepare(
    `INSERT INTO items (id, owner_id, title, category, description, care_notes, lend_days, visibility, archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    uid(),
    user.id,
    title,
    str(form, "category") || "other",
    str(form, "description"),
    str(form, "care_notes"),
    lendDays,
    visibility,
    now()
  );
  refresh();
  redirect("/shelf");
}

export async function updateItem(itemId: string, form: FormData): Promise<void> {
  const user = await requireUser();
  const item = itemById(itemId);
  if (!item || item.owner_id !== user.id) fail("/shelf", "That's not your item.");
  const title = str(form, "title");
  if (!title) fail(`/items/${itemId}`, "Every item needs a title.");
  const lendDaysRaw = str(form, "lend_days");
  const lendDays = lendDaysRaw ? Math.max(1, Math.min(365, parseInt(lendDaysRaw, 10) || 0)) : null;
  const visibility = str(form, "visibility") === "neighbors" ? "neighbors" : "friends";
  db.prepare(
    `UPDATE items SET title = ?, category = ?, description = ?, care_notes = ?, lend_days = ?, visibility = ?
     WHERE id = ?`
  ).run(
    title,
    str(form, "category") || "other",
    str(form, "description"),
    str(form, "care_notes"),
    lendDays,
    visibility,
    itemId
  );
  refresh();
  redirect(`/items/${itemId}`);
}

export async function toggleArchiveItem(itemId: string): Promise<void> {
  const user = await requireUser();
  const item = itemById(itemId);
  if (!item || item.owner_id !== user.id) fail("/shelf", "That's not your item.");
  if (!item.archived && activeLoanForItem(itemId))
    fail(`/items/${itemId}`, "Finish the open loan before shelving this item.");
  db.prepare("UPDATE items SET archived = ? WHERE id = ?").run(item.archived ? 0 : 1, itemId);
  refresh();
  redirect("/shelf");
}

/* ---------- loans ---------- */

export async function requestLoan(itemId: string, form: FormData): Promise<void> {
  const user = await requireUser();
  const item = itemById(itemId);
  if (!item || item.archived) fail("/home", "That item isn't available.");
  if (item.owner_id === user.id) fail(`/items/${itemId}`, "It's already yours!");
  if (activeLoanForItem(itemId)) fail(`/items/${itemId}`, "Someone else has this one right now.");
  db.prepare(
    `INSERT INTO loans (id, item_id, borrower_id, status, message, created_at)
     VALUES (?, ?, ?, 'requested', ?, ?)`
  ).run(uid(), itemId, user.id, str(form, "message"), now());
  notify(item.owner_id, `${user.name} would like to borrow “${item.title}”.`, `/items/${itemId}`);
  refresh();
  redirect(`/items/${itemId}`);
}

export async function approveLoan(loanId: string): Promise<void> {
  const user = await requireUser();
  const loan = loanById(loanId);
  if (!loan || loan.owner_id !== user.id || loan.status !== "requested")
    fail("/loans", "That request can't be approved.");
  db.prepare("UPDATE loans SET status = 'reserved', reserved_at = ? WHERE id = ?").run(
    now(),
    loanId
  );
  notify(
    loan.borrower_id,
    `${user.name} said yes to “${loan.title}” — arrange a pickup!`,
    `/items/${loan.item_id}`
  );
  refresh();
  redirect(`/items/${loan.item_id}`);
}

export async function declineLoan(loanId: string): Promise<void> {
  const user = await requireUser();
  const loan = loanById(loanId);
  if (!loan || loan.owner_id !== user.id || !["requested", "reserved"].includes(loan.status))
    fail("/loans", "That request can't be declined.");
  db.prepare("UPDATE loans SET status = 'declined', closed_at = ? WHERE id = ?").run(now(), loanId);
  notify(
    loan.borrower_id,
    `“${loan.title}” isn't available right now.`,
    `/items/${loan.item_id}`
  );
  refresh();
  redirect(`/items/${loan.item_id}`);
}

export async function cancelLoan(loanId: string): Promise<void> {
  const user = await requireUser();
  const loan = loanById(loanId);
  if (!loan || loan.borrower_id !== user.id || !["requested", "reserved"].includes(loan.status))
    fail("/loans", "That reservation can't be cancelled.");
  db.prepare("UPDATE loans SET status = 'cancelled', closed_at = ? WHERE id = ?").run(
    now(),
    loanId
  );
  notify(loan.owner_id, `${user.name} withdrew the request for “${loan.title}”.`, `/items/${loan.item_id}`);
  refresh();
  redirect(`/items/${loan.item_id}`);
}

export async function markHandedOver(loanId: string): Promise<void> {
  const user = await requireUser();
  const loan = loanById(loanId);
  if (!loan || loan.owner_id !== user.id || loan.status !== "reserved")
    fail("/loans", "This loan isn't ready to hand over.");
  const item = itemById(loan.item_id);
  const t = now();
  const dueAt = item?.lend_days ? t + item.lend_days * DAY : null;
  db.prepare("UPDATE loans SET status = 'out', out_at = ?, due_at = ? WHERE id = ?").run(
    t,
    dueAt,
    loanId
  );
  const dueNote = dueAt
    ? ` It's due back by ${new Date(dueAt).toLocaleDateString()} — we'll remind you.`
    : "";
  notify(loan.borrower_id, `“${loan.title}” is yours for now. Enjoy it!${dueNote}`, `/items/${loan.item_id}`);
  refresh();
  redirect(`/items/${loan.item_id}`);
}

export async function markReturned(loanId: string): Promise<void> {
  const user = await requireUser();
  const loan = loanById(loanId);
  if (!loan || loan.owner_id !== user.id || loan.status !== "out")
    fail("/loans", "This loan isn't out.");
  db.prepare("UPDATE loans SET status = 'returned', closed_at = ? WHERE id = ?").run(
    now(),
    loanId
  );
  notify(
    loan.borrower_id,
    `“${loan.title}” is back on ${user.name}'s shelf. Thanks for taking care of it.`,
    `/items/${loan.item_id}`
  );
  refresh();
  redirect(`/items/${loan.item_id}`);
}

/* ---------- friends ---------- */

export async function sendFriendRequest(form: FormData): Promise<void> {
  const user = await requireUser();
  const username = str(form, "username").toLowerCase().replace(/^@/, "");
  const other = userByUsername(username);
  if (!other) fail("/people", `No one here goes by @${username} yet — invite them!`);
  if (other.id === user.id) fail("/people", "You're already your own friend, we hope.");
  const existing = db
    .prepare(
      `SELECT * FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`
    )
    .get(user.id, other.id, other.id, user.id);
  if (existing) fail("/people", `You and @${username} are already connected (or pending).`);
  db.prepare(
    "INSERT INTO friendships (id, requester_id, addressee_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)"
  ).run(uid(), user.id, other.id, now());
  notify(other.id, `${user.name} (@${user.username}) wants to share with you.`, "/people");
  refresh();
  redirect("/people");
}

export async function respondFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  const user = await requireUser();
  const f = db.prepare("SELECT * FROM friendships WHERE id = ?").get(friendshipId) as
    | unknown as { id: string; requester_id: string; addressee_id: string; status: string }
    | undefined;
  if (!f || f.addressee_id !== user.id || f.status !== "pending")
    fail("/people", "That request isn't yours to answer.");
  if (accept) {
    db.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?").run(friendshipId);
    notify(f.requester_id, `${user.name} accepted — you're now sharing shelves.`, "/people");
  } else {
    db.prepare("DELETE FROM friendships WHERE id = ?").run(friendshipId);
  }
  refresh();
  redirect("/people");
}

export async function removeFriend(friendshipId: string): Promise<void> {
  const user = await requireUser();
  const f = db.prepare("SELECT * FROM friendships WHERE id = ?").get(friendshipId) as
    | unknown as { requester_id: string; addressee_id: string }
    | undefined;
  if (!f || (f.requester_id !== user.id && f.addressee_id !== user.id))
    fail("/people", "That friendship isn't yours.");
  db.prepare("DELETE FROM friendships WHERE id = ?").run(friendshipId);
  refresh();
  redirect("/people");
}

/* ---------- circles & crews ---------- */

export async function createCircle(form: FormData): Promise<void> {
  const user = await requireUser();
  const name = str(form, "name");
  const kindRaw = str(form, "kind");
  const kind = ["crew", "neighborhood", "city"].includes(kindRaw) ? kindRaw : "crew";
  const backTo = kind === "crew" ? "/people" : "/circles";
  if (!name) fail(backTo, "Give it a name.");
  const id = uid();
  db.prepare(
    `INSERT INTO circles (id, name, kind, area, description, invite_code, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, kind, str(form, "area"), str(form, "description"), newInviteCode(), user.id, now());
  db.prepare("INSERT INTO circle_members (circle_id, user_id, joined_at) VALUES (?, ?, ?)").run(
    id,
    user.id,
    now()
  );
  refresh();
  redirect(backTo);
}

export async function joinCircle(circleId: string): Promise<void> {
  const user = await requireUser();
  const circle = circleById(circleId);
  if (!circle || circle.kind === "crew") fail("/circles", "That circle can't be joined directly.");
  if (!isCircleMember(circleId, user.id)) {
    db.prepare("INSERT INTO circle_members (circle_id, user_id, joined_at) VALUES (?, ?, ?)").run(
      circleId,
      user.id,
      now()
    );
  }
  refresh();
  redirect("/circles");
}

export async function joinByInviteCode(form: FormData): Promise<void> {
  const user = await requireUser();
  const code = str(form, "code").toLowerCase();
  const circle = db.prepare("SELECT * FROM circles WHERE invite_code = ?").get(code) as
    | unknown as { id: string; name: string; kind: string }
    | undefined;
  if (!circle) fail("/people", "That invite code doesn't match anything.");
  if (!isCircleMember(circle.id, user.id)) {
    db.prepare("INSERT INTO circle_members (circle_id, user_id, joined_at) VALUES (?, ?, ?)").run(
      circle.id,
      user.id,
      now()
    );
  }
  refresh();
  redirect(circle.kind === "crew" ? "/people" : "/circles");
}

export async function leaveCircle(circleId: string): Promise<void> {
  const user = await requireUser();
  db.prepare("DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?").run(
    circleId,
    user.id
  );
  // Tidy up empty circles so abandoned ones don't clutter the browse list.
  const left = db
    .prepare("SELECT COUNT(*) AS n FROM circle_members WHERE circle_id = ?")
    .get(circleId) as unknown as { n: number };
  if (left.n === 0) db.prepare("DELETE FROM circles WHERE id = ?").run(circleId);
  refresh();
  redirect("/circles");
}

/* ---------- notifications ---------- */

export async function markAllRead(): Promise<void> {
  const user = await requireUser();
  db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  refresh();
  redirect("/notifications");
}
