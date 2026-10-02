import { getBoardReads } from "@/lib/jevBoard";
import { MissingJevKeyError } from "@/lib/jev";
import { toCategory } from "@/lib/filters";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/jev/board[?c=sports]: Jev's call on every board market (10-min cache per market). */
export async function GET(req: Request) {
  try {
    const { reads } = await getBoardReads(toCategory(new URL(req.url).searchParams.get("c")));
    return Response.json({ reads, asOf: new Date().toISOString() });
  } catch (err) {
    if (err instanceof MissingJevKeyError) {
      return Response.json({ available: false, reason: err.message });
    }
    const message = err instanceof Error ? err.message : "Board lookup failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
