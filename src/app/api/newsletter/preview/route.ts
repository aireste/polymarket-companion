import { renderIssueHtml, todaysIssue } from "@/lib/newsletter";
import { MissingJevKeyError } from "@/lib/jev";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/newsletter/preview: today's email exactly as subscribers would get it. */
export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  try {
    const html = await renderIssueHtml(await todaysIssue({ fresh }));
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    const msg = err instanceof MissingJevKeyError ? "Jev isn't configured on this server." : err instanceof Error ? err.message : "Preview failed";
    return new Response(msg, { status: 502 });
  }
}
