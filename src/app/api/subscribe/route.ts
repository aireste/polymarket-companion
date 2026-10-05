import { isEmail, joinWaitlist, newsletterConfigured, subscribe } from "@/lib/newsletter";
import { rateLimit, clientKey } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** POST /api/subscribe { email } → join HedgePredict Daily. */
export async function POST(request: Request) {
  const gate = rateLimit(`subscribe:${clientKey(request)}`, 5, 60 * 60 * 1000);
  if (!gate.ok) return Response.json({ error: "Too many tries. Give it a few minutes." }, { status: 429 });

  let email = "";
  let source = "site";
  let trap = "";
  try {
    const body = (await request.json()) as { email?: unknown; source?: unknown; company?: unknown };
    email = String(body.email ?? "").trim().toLowerCase();
    source = String(body.source ?? "site").slice(0, 40);
    trap = String(body.company ?? "");
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  // Honeypot: people never see or fill "company"; bots do. Pretend it worked.
  if (trap) return Response.json({ ok: true });
  if (!isEmail(email)) return Response.json({ error: "That doesn't look like an email address." }, { status: 400 });

  // Before launch the list lives in Formspree; after, in Resend. Same UI either way.
  const res = newsletterConfigured() ? await subscribe(email) : await joinWaitlist(email, source);
  return res.ok ? Response.json({ ok: true, live: newsletterConfigured() }) : Response.json({ error: "Couldn't sign you up just now. Try again." }, { status: 502 });
}
