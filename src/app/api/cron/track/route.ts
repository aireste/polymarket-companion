import { gradeOpenCalls, logNewCalls, trackSummary } from "@/lib/trackRecord";
import { syncSubscribers } from "@/lib/newsletter";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/cron/track: Vercel Cron, every 30 minutes. Logs new Wager/Lean calls, grades resolved
 * ones, and refreshes the copy of the Daily's subscriber list.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let added = 0;
  let logError: string | null = null;
  try {
    added = await logNewCalls();
  } catch (err) {
    logError = err instanceof Error ? err.message : "Couldn't read calls";
  }
  // Grade even if logging failed: resolved markets shouldn't wait on the board.
  const graded = await gradeOpenCalls();
  // While we're here: refresh the copy of the Daily's subscriber list (one cheap Resend call).
  const subscribers = await syncSubscribers().catch(() => null);
  return Response.json({ added, graded, logError, subscribers, summary: await trackSummary() });
}
