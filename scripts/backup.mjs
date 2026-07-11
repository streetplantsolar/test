// Consistent, online backup of the Comn.one SQLite database.
//
//   node scripts/backup.mjs
//
// Uses SQLite's `VACUUM INTO`, which produces a clean single-file snapshot
// that is safe to take while the app is running (no WAL corruption, unlike a
// naive `cp` of a live WAL-mode database). Old snapshots are pruned.
//
// Env:
//   COMN_DATA_DIR    where comn.db lives            (default ./data)
//   COMN_BACKUP_DIR  where snapshots are written     (default <data>/backups)
//   COMN_BACKUP_KEEP how many snapshots to retain    (default 14)

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.COMN_DATA_DIR || path.join(process.cwd(), "data");
const src = path.join(dataDir, "comn.db");
if (!fs.existsSync(src)) {
  console.error(`No database found at ${src}. Set COMN_DATA_DIR if it lives elsewhere.`);
  process.exit(1);
}

const backupDir = process.env.COMN_BACKUP_DIR || path.join(dataDir, "backups");
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.join(backupDir, `comn-${stamp}.db`);

const db = new DatabaseSync(src);
try {
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
} finally {
  db.close();
}

// Prune: keep the newest COMN_BACKUP_KEEP snapshots (timestamped names sort
// chronologically as strings).
const keep = Number(process.env.COMN_BACKUP_KEEP || 14);
const snapshots = fs
  .readdirSync(backupDir)
  .filter((f) => /^comn-.*\.db$/.test(f))
  .sort();
for (const stale of snapshots.slice(0, Math.max(0, snapshots.length - keep))) {
  fs.rmSync(path.join(backupDir, stale));
}

const bytes = fs.statSync(dest).size;
console.log(`Backup written: ${dest} (${(bytes / 1024).toFixed(1)} KiB)`);
