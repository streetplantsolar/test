import { NextRequest, NextResponse } from "next/server";
import { snapshotDatabase } from "@/lib/backup";

// Scheduler entrypoint for database snapshots — for hosts (like Render)
// where you can't run `npm run backup` from system cron. Same auth as
// /api/cron/remind:
//
//   0 3 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://comn.one/api/cron/backup
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = snapshotDatabase();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
