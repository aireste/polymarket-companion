import { sendFeedback } from "@/lib/feedback";
import { isEmail } from "@/lib/newsletter";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** POST /api/feedback { message, email?, page? } → a note in the owner's inbox. */
export async function POST(request: Request) {
  const gate = rateLimit(`feedback:${clientKey(request)}`, 5, 60 * 60 * 1000);
  if (!gate.ok) return Response.json({ error: "That's a lot of notes at once. Give it a few minutes." }, { status: 429 });

  let message = "";
  let email = "";
  let page = "";
  let trap = "";
  try {
    const body = (await request.json()) as { message?: unknown; email?: unknown; page?: unknown; company?: unknown };
    message = String(body.message ?? "").trim().slice(0, 4000);
    email = String(body.email ?? "").trim().toLowerCase();
    page = String(body.page ?? "").slice(0, 120);
    trap = String(body.company ?? "");
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  // Honeypot: people never see or fill "company"; bots do. Pretend it worked.
  if (trap) return Response.json({ ok: true });
  if (message.length < 3) return Response.json({ error: "Write a few words first." }, { status: 400 });
  if (email && !isEmail(email)) return Response.json({ error: "That email doesn't look right. Fix it or leave it blank." }, { status: 400 });

  const res = await sendFeedback({ message, email: email || undefined, page });
  return res.ok ? Response.json({ ok: true }) : Response.json({ error: "Couldn't send that just now. Try again in a minute." }, { status: 502 });
}
