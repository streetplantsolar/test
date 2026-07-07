import { DatabaseSync } from "node:sqlite";
import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  place TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  supporter INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  addressee_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  UNIQUE (requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS circles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  invite_code TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS circle_members (
  circle_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (circle_id, user_id)
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  care_notes TEXT NOT NULL DEFAULT '',
  lend_days INTEGER,
  visibility TEXT NOT NULL DEFAULT 'friends',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  borrower_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  message TEXT NOT NULL DEFAULT '',
  due_at INTEGER,
  reminded_stage INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  reserved_at INTEGER,
  out_at INTEGER,
  closed_at INTEGER
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships (addressee_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON circle_members (user_id);
CREATE INDEX IF NOT EXISTS idx_items_owner ON items (owner_id);
CREATE INDEX IF NOT EXISTS idx_loans_item ON loans (item_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans (borrower_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
`;

function connect(): DatabaseSync {
  const dataDir = process.env.COMN_DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const conn = new DatabaseSync(path.join(dataDir, "comn.db"));
  conn.exec("PRAGMA busy_timeout = 5000;");
  conn.exec("PRAGMA journal_mode = WAL;");
  conn.exec(SCHEMA);
  return conn;
}

// Cache the connection on globalThis so dev-mode module reloads reuse it,
// and open it lazily so merely importing this module (e.g. during the
// build's page-data collection, which runs several workers) touches nothing.
const g = globalThis as unknown as { __comnDb?: DatabaseSync };
const getConn = (): DatabaseSync => (g.__comnDb ??= connect());

export const db: DatabaseSync = new Proxy({} as DatabaseSync, {
  get(_target, prop: keyof DatabaseSync) {
    const conn = getConn();
    const value = conn[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(conn) : value;
  },
});

export const uid = (): string => randomUUID();
export const now = (): number => Date.now();
export const newInviteCode = (): string => randomBytes(4).toString("hex");
