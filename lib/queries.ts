import { db, now, uid } from "./db";
import type { Circle, Item, Loan, Notification, User } from "./types";

/** Item joined with owner info and the status of its active loan, if any. */
export interface ShelfItem extends Item {
  owner_username: string;
  owner_name: string;
  loan_status: string | null;
}

export interface LoanRow extends Loan {
  title: string;
  category: string;
  owner_id: string;
  owner_username: string;
  owner_name: string;
  borrower_username: string;
  borrower_name: string;
}

const ACTIVE_LOAN =
  "(SELECT status FROM loans WHERE item_id = i.id AND status IN ('requested','reserved','out') ORDER BY created_at DESC LIMIT 1)";

// True when the two users are direct friends or share a crew (friend group).
const IS_FRIEND_OR_CREWMATE = `(
  EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted'
          AND ((f.requester_id = ? AND f.addressee_id = i.owner_id)
            OR (f.addressee_id = ? AND f.requester_id = i.owner_id)))
  OR EXISTS (SELECT 1 FROM circle_members m1
             JOIN circle_members m2 ON m1.circle_id = m2.circle_id
             JOIN circles c ON c.id = m1.circle_id
             WHERE m1.user_id = ? AND m2.user_id = i.owner_id AND c.kind = 'crew')
)`;

// True when the item is opened to neighbors and the two users share a
// neighborhood or city circle.
const IS_VISIBLE_NEIGHBOR = `(
  i.visibility = 'neighbors'
  AND EXISTS (SELECT 1 FROM circle_members m1
              JOIN circle_members m2 ON m1.circle_id = m2.circle_id
              JOIN circles c ON c.id = m1.circle_id
              WHERE m1.user_id = ? AND m2.user_id = i.owner_id
                AND c.kind IN ('neighborhood','city'))
)`;

export function feedItems(viewerId: string, q: string, category: string): ShelfItem[] {
  let sql = `
    SELECT i.*, u.username AS owner_username, u.name AS owner_name,
           ${ACTIVE_LOAN} AS loan_status
    FROM items i JOIN users u ON u.id = i.owner_id
    WHERE i.archived = 0 AND i.owner_id != ?
      AND (${IS_FRIEND_OR_CREWMATE} OR ${IS_VISIBLE_NEIGHBOR})`;
  const params: (string | number)[] = [viewerId, viewerId, viewerId, viewerId, viewerId];
  if (q) {
    sql += " AND (i.title LIKE ? OR i.description LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    sql += " AND i.category = ?";
    params.push(category);
  }
  sql += " ORDER BY i.created_at DESC";
  return db.prepare(sql).all(...params) as unknown as ShelfItem[];
}

export function canViewItem(viewerId: string, item: Item): boolean {
  if (item.owner_id === viewerId) return true;
  const row = db
    .prepare(
      `SELECT 1 FROM items i
       WHERE i.id = ? AND (${IS_FRIEND_OR_CREWMATE} OR ${IS_VISIBLE_NEIGHBOR})`
    )
    .get(item.id, viewerId, viewerId, viewerId, viewerId);
  return row !== undefined;
}

export function itemById(id: string): Item | null {
  return (db.prepare("SELECT * FROM items WHERE id = ?").get(id) as unknown as Item) ?? null;
}

export function myItems(ownerId: string): ShelfItem[] {
  return db
    .prepare(
      `SELECT i.*, u.username AS owner_username, u.name AS owner_name,
              ${ACTIVE_LOAN} AS loan_status
       FROM items i JOIN users u ON u.id = i.owner_id
       WHERE i.owner_id = ? ORDER BY i.archived, i.created_at DESC`
    )
    .all(ownerId) as unknown as ShelfItem[];
}

export function itemsOfOwnerVisibleTo(viewerId: string, ownerId: string): ShelfItem[] {
  return db
    .prepare(
      `SELECT i.*, u.username AS owner_username, u.name AS owner_name,
              ${ACTIVE_LOAN} AS loan_status
       FROM items i JOIN users u ON u.id = i.owner_id
       WHERE i.archived = 0 AND i.owner_id = ?
         AND (${IS_FRIEND_OR_CREWMATE} OR ${IS_VISIBLE_NEIGHBOR})
       ORDER BY i.created_at DESC`
    )
    .all(ownerId, viewerId, viewerId, viewerId, viewerId) as unknown as ShelfItem[];
}

export function activeLoanForItem(itemId: string): LoanRow | null {
  return (
    (db
      .prepare(
        `SELECT l.*, i.title, i.category, i.owner_id,
                ou.username AS owner_username, ou.name AS owner_name,
                bu.username AS borrower_username, bu.name AS borrower_name
         FROM loans l
         JOIN items i ON i.id = l.item_id
         JOIN users ou ON ou.id = i.owner_id
         JOIN users bu ON bu.id = l.borrower_id
         WHERE l.item_id = ? AND l.status IN ('requested','reserved','out')
         ORDER BY l.created_at DESC LIMIT 1`
      )
      .get(itemId) as unknown as LoanRow) ?? null
  );
}

export function loanById(id: string): LoanRow | null {
  return (
    (db
      .prepare(
        `SELECT l.*, i.title, i.category, i.owner_id,
                ou.username AS owner_username, ou.name AS owner_name,
                bu.username AS borrower_username, bu.name AS borrower_name
         FROM loans l
         JOIN items i ON i.id = l.item_id
         JOIN users ou ON ou.id = i.owner_id
         JOIN users bu ON bu.id = l.borrower_id
         WHERE l.id = ?`
      )
      .get(id) as unknown as LoanRow) ?? null
  );
}

export function myBorrowing(userId: string): LoanRow[] {
  return db
    .prepare(
      `SELECT l.*, i.title, i.category, i.owner_id,
              ou.username AS owner_username, ou.name AS owner_name,
              bu.username AS borrower_username, bu.name AS borrower_name
       FROM loans l
       JOIN items i ON i.id = l.item_id
       JOIN users ou ON ou.id = i.owner_id
       JOIN users bu ON bu.id = l.borrower_id
       WHERE l.borrower_id = ? AND l.status IN ('requested','reserved','out')
       ORDER BY l.created_at DESC`
    )
    .all(userId) as unknown as LoanRow[];
}

export function myLending(userId: string): LoanRow[] {
  return db
    .prepare(
      `SELECT l.*, i.title, i.category, i.owner_id,
              ou.username AS owner_username, ou.name AS owner_name,
              bu.username AS borrower_username, bu.name AS borrower_name
       FROM loans l
       JOIN items i ON i.id = l.item_id
       JOIN users ou ON ou.id = i.owner_id
       JOIN users bu ON bu.id = l.borrower_id
       WHERE i.owner_id = ? AND l.status IN ('requested','reserved','out')
       ORDER BY l.created_at DESC`
    )
    .all(userId) as unknown as LoanRow[];
}

export function loanHistory(userId: string): LoanRow[] {
  return db
    .prepare(
      `SELECT l.*, i.title, i.category, i.owner_id,
              ou.username AS owner_username, ou.name AS owner_name,
              bu.username AS borrower_username, bu.name AS borrower_name
       FROM loans l
       JOIN items i ON i.id = l.item_id
       JOIN users ou ON ou.id = i.owner_id
       JOIN users bu ON bu.id = l.borrower_id
       WHERE (l.borrower_id = ? OR i.owner_id = ?) AND l.status = 'returned'
       ORDER BY l.closed_at DESC LIMIT 30`
    )
    .all(userId, userId) as unknown as LoanRow[];
}

export interface FriendRow extends User {
  friendship_id: string;
}

export function friendsOf(userId: string): FriendRow[] {
  return db
    .prepare(
      `SELECT u.*, f.id AS friendship_id FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
       WHERE f.status = 'accepted' AND (f.requester_id = ? OR f.addressee_id = ?)
       ORDER BY u.name`
    )
    .all(userId, userId, userId) as unknown as FriendRow[];
}

export function incomingRequests(userId: string): FriendRow[] {
  return db
    .prepare(
      `SELECT u.*, f.id AS friendship_id FROM friendships f
       JOIN users u ON u.id = f.requester_id
       WHERE f.status = 'pending' AND f.addressee_id = ?
       ORDER BY f.created_at DESC`
    )
    .all(userId) as unknown as FriendRow[];
}

export function outgoingRequests(userId: string): FriendRow[] {
  return db
    .prepare(
      `SELECT u.*, f.id AS friendship_id FROM friendships f
       JOIN users u ON u.id = f.addressee_id
       WHERE f.status = 'pending' AND f.requester_id = ?
       ORDER BY f.created_at DESC`
    )
    .all(userId) as unknown as FriendRow[];
}

export interface CircleRow extends Circle {
  member_count: number;
  is_member: number;
}

export function circlesOf(userId: string, kinds: string[]): CircleRow[] {
  const placeholders = kinds.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM circle_members m WHERE m.circle_id = c.id) AS member_count,
              1 AS is_member
       FROM circles c
       JOIN circle_members me ON me.circle_id = c.id AND me.user_id = ?
       WHERE c.kind IN (${placeholders})
       ORDER BY c.name`
    )
    .all(userId, ...kinds) as unknown as CircleRow[];
}

export function browseCircles(userId: string, q: string): CircleRow[] {
  let sql = `
    SELECT c.*,
           (SELECT COUNT(*) FROM circle_members m WHERE m.circle_id = c.id) AS member_count,
           EXISTS (SELECT 1 FROM circle_members m WHERE m.circle_id = c.id AND m.user_id = ?) AS is_member
    FROM circles c
    WHERE c.kind IN ('neighborhood','city')`;
  const params: string[] = [userId];
  if (q) {
    sql += " AND (c.name LIKE ? OR c.area LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += " ORDER BY c.kind, c.name";
  return db.prepare(sql).all(...params) as unknown as CircleRow[];
}

export function circleById(id: string): Circle | null {
  return (db.prepare("SELECT * FROM circles WHERE id = ?").get(id) as unknown as Circle) ?? null;
}

export function circleMembers(circleId: string): User[] {
  return db
    .prepare(
      `SELECT u.* FROM circle_members m JOIN users u ON u.id = m.user_id
       WHERE m.circle_id = ? ORDER BY u.name`
    )
    .all(circleId) as unknown as User[];
}

export function isCircleMember(circleId: string, userId: string): boolean {
  return (
    db
      .prepare("SELECT 1 FROM circle_members WHERE circle_id = ? AND user_id = ?")
      .get(circleId, userId) !== undefined
  );
}

export function userById(id: string): User | null {
  return ((db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as User) ?? null);
}

export function userByUsername(username: string): User | null {
  return (
    (db.prepare("SELECT * FROM users WHERE username = ?").get(username) as unknown as User) ?? null
  );
}

export function notificationsOf(userId: string): Notification[] {
  return db
    .prepare(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100"
    )
    .all(userId) as unknown as Notification[];
}

export function unreadCount(userId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0")
    .get(userId) as unknown as { n: number };
  return row.n;
}

export function notify(userId: string, body: string, href: string): void {
  db.prepare(
    "INSERT INTO notifications (id, user_id, body, href, read, created_at) VALUES (?, ?, ?, ?, 0, ?)"
  ).run(uid(), userId, body, href, now());
}
