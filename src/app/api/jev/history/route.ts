import { getCallHistory } from "@/lib/callHistory";

export const dynamic = "force-dynamic";

/** GET /api/jev/history?id=<marketId>: how this market's call changed, oldest first. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id || id.length > 200) return Response.json({ error: "Missing or invalid id" }, { status: 400 });
  try {
    const changes = await getCallHistory(id);
    return Response.json({ changes }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "History lookup failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
