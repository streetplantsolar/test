import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// Consistent online snapshot of the live database via VACUUM INTO (safe
// while the app is running, unlike copying a WAL-mode file by hand).
// Shared by `npm run backup` (scripts/backup.mjs mirrors this for standalone
// use) and the GET /api/cron/backup endpoint used on hosts like Render.
export function snapshotDatabase(): { file: string; bytes: number; kept: number } {
  const dataDir = process.env.COMN_DATA_DIR || path.join(process.cwd(), "data");
  const src = path.join(dataDir, "comn.db");
  if (!fs.existsSync(src)) throw new Error(`No database at ${src}`);

  const backupDir = process.env.COMN_BACKUP_DIR || path.join(dataDir, "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(backupDir, `comn-${stamp}.db`);

  const conn = new DatabaseSync(src);
  try {
    conn.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  } finally {
    conn.close();
  }

  const keep = Number(process.env.COMN_BACKUP_KEEP || 14);
  const snapshots = fs
    .readdirSync(backupDir)
    .filter((f) => /^comn-.*\.db$/.test(f))
    .sort();
  for (const stale of snapshots.slice(0, Math.max(0, snapshots.length - keep))) {
    fs.rmSync(path.join(backupDir, stale));
  }

  return {
    file: dest,
    bytes: fs.statSync(dest).size,
    kept: Math.min(snapshots.length, keep),
  };
}
