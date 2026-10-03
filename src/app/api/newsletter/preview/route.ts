import { renderIssueHtml, todaysIssue } from "@/lib/newsletter";
import { cachedPreview } from "@/lib/dailyPreview";
import { MissingJevKeyError } from "@/lib/jev";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/newsletter/preview: today's email exactly as subscribers would get it.
 * `?fresh=1` rebuilds it now (board reads, news lookups, writing), so it needs the cron secret.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  if (fresh && (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    // Fresh rebuilds; otherwise today's saved issue (the tour loads this too).
    const html = fresh ? await renderIssueHtml(await todaysIssue({ fresh })) : (await cachedPreview()).html;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    const msg = err instanceof MissingJevKeyError ? "Jev isn't configured on this server." : err instanceof Error ? err.message : "Preview failed";
    return new Response(msg, { status: 502 });
  }
}
