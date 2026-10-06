import { unstable_cache } from "next/cache";
import { getTrackRecord } from "@/lib/trackRecord";
import { followSummary } from "@/lib/recordMath";

export const dynamic = "force-dynamic";

const cached = unstable_cache(async () => followSummary((await getTrackRecord()).calls), ["follow-summary", "v1"], { revalidate: 300 });

/** GET /api/track/summary: "if you'd followed every Wager / Lean", for the board's one-liner. */
export async function GET() {
  try {
    return Response.json(await cached(), { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Track record unavailable";
    return Response.json({ error: message }, { status: 502 });
  }
}
