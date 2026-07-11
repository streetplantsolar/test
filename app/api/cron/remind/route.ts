import { NextRequest, NextResponse } from "next/server";
import { runReminderSweep } from "@/lib/reminders";

// Scheduler entrypoint for due-date reminders, so they go out even when
// nobody is browsing the site. Protect it with CRON_SECRET and call it from
// cron (or your host's scheduler):
//
//   */30 * * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://comn.one/api/cron/remind
//
// Without CRON_SECRET set, the route is disabled (the lazy in-app sweep on
// page loads still runs regardless).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sent = runReminderSweep();
  return NextResponse.json({ ok: true, reminders_sent: sent });
}
