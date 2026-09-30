import { fetchHistory, isTokenId } from "@/lib/history";

export const dynamic = "force-dynamic";

/** GET /api/history?token=<clobTokenId>&range=1d|1w|1m */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const range = searchParams.get("range") ?? "1w";

  if (!isTokenId(token)) {
    return Response.json({ error: "Missing or invalid token" }, { status: 400 });
  }

  try {
    const history = await fetchHistory(token, range);
    return Response.json({ history });
  } catch (err) {
    const message = err instanceof Error ? err.message : "History failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
