/**
 * POST /api/jev/explain  { read: JevReadDTO }
 *
 * On-demand: Claude explains why Jev made its calibrated call. The client passes
 * the read it's already displaying so the explanation matches the chip exactly
 * and we don't re-run Jev. Rate-limited per IP; the Anthropic spend cap is the
 * real cost guard (mirrors /api/chat).
 */
import { explainJev } from "@/lib/jevExplain";
import { MissingCredentialsError } from "@/lib/read";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import type { JevReadDTO } from "@/lib/dto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const gate = rateLimit(`jev-explain:${clientKey(request)}`);
  if (!gate.ok) {
    return Response.json(
      { error: `Too many explanations. Try again in ${gate.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(gate.retryAfterSec) } }
    );
  }

  let read: JevReadDTO | undefined;
  try {
    const body = (await request.json()) as { read?: JevReadDTO };
    read = body?.read;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!read || typeof read.action !== "string") {
    return Response.json({ error: "Missing Jev read" }, { status: 400 });
  }

  try {
    const { explanation, model } = await explainJev(read);
    return Response.json({ explanation, model });
  } catch (err) {
    if (err instanceof MissingCredentialsError) {
      return Response.json({ available: false, reason: err.message }, { status: 200 });
    }
    const message = err instanceof Error ? err.message : "Explanation failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
