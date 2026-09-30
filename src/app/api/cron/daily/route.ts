import { newsletterConfigured, sendIssue, todaysIssue } from "@/lib/newsletter";
import { MARKET_TZ } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/cron/daily: called by Vercel Cron at 12:00 and 13:00 UTC on
 * weekdays. Cron runs in UTC, so we send from whichever call lands at 8 AM
 * Eastern: 12:00 UTC in summer (EDT), 13:00 UTC in winter (EST).
 * `?force=1` (with the secret) sends now, for a manual test.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const force = new URL(request.url).searchParams.get("force") === "1";

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: MARKET_TZ, hour: "numeric", hour12: false, weekday: "short" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  const hourET = Number(parts.hour);
  const weekday = !["Sat", "Sun"].includes(parts.weekday);
  if (!force && (hourET !== 8 || !weekday)) {
    return Response.json({ skipped: `not 8 AM ET on a weekday (it's ${parts.weekday} ${hourET}:00 ET)` });
  }
  if (!newsletterConfigured()) return Response.json({ skipped: "newsletter not configured yet" });

  try {
    const issue = await todaysIssue();
    const { id } = await sendIssue(issue);
    return Response.json({ sent: true, broadcast: id, date: issue.date, subject: issue.subject });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Send failed" }, { status: 502 });
  }
}
