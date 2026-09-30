import { isEmail, newsletterConfigured, subscribe } from "@/lib/newsletter";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** POST /api/subscribe { email } → join HedgePredict Daily. */
export async function POST(request: Request) {
  const gate = rateLimit(`subscribe:${clientKey(request)}`, 5, 60 * 60 * 1000);
  if (!gate.ok) return Response.json({ error: "Too many tries. Give it a few minutes." }, { status: 429 });

  let email = "";
  try {
    email = String(((await request.json()) as { email?: unknown }).email ?? "").trim().toLowerCase();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!isEmail(email)) return Response.json({ error: "That doesn't look like an email address." }, { status: 400 });

  if (!newsletterConfigured()) {
    return Response.json({ ok: false, pending: true, message: "The Daily launches soon. Signups open when it does." });
  }
  const res = await subscribe(email);
  return res.ok ? Response.json({ ok: true }) : Response.json({ error: "Couldn't sign you up just now. Try again." }, { status: 502 });
}
