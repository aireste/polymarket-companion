/**
 * Feedback from the site lands in the owner's inbox through Formspree (the same form the
 * pre-launch waitlist used), so there's no mailbox or database to run. If the person leaves an
 * email it's set as the reply-to, so answering is just hitting reply.
 */
const FORMSPREE = process.env.FORMSPREE_ENDPOINT ?? "https://formspree.io/f/mljdvoyo";

export async function sendFeedback(input: { message: string; email?: string; page?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(FORMSPREE, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        _subject: "HedgePredict feedback",
        message: input.message,
        ...(input.email ? { email: input.email, _replyto: input.email } : { email: "no-reply-given@hedgepredict.co" }),
        page: input.page ?? "",
      }),
    });
    if (res.ok) return { ok: true };
    const d = (await res.json().catch(() => ({}))) as { errors?: { message?: string }[] };
    return { ok: false, error: d.errors?.[0]?.message ?? `Formspree returned ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Feedback couldn't be sent" };
  }
}
