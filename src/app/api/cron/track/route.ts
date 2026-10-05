import { gradeOpenCalls, logNewCalls, trackSummary } from "@/lib/trackRecord";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** GET /api/cron/track: Vercel Cron, every 30 minutes. Logs new Wager/Lean calls, grades resolved ones. */
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
  return Response.json({ added, graded, logError, summary: await trackSummary() });
}
