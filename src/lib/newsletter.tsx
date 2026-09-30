/**
 * Newsletter plumbing (Resend). Everything keys off env vars, so the site runs
 * fine before email is set up; the send and signup routes report "not
 * configured" instead of failing.
 *
 *   RESEND_API_KEY       Resend API key
 *   RESEND_SEGMENT_ID    segment that holds Daily subscribers
 *   NEWSLETTER_FROM      e.g. "HedgePredict Daily <daily@hedgepredict.co>" (verified domain)
 *   NEWSLETTER_ADDRESS   postal address for the footer (CAN-SPAM)
 *   CRON_SECRET          Vercel sends it as a Bearer token to the cron route
 */
import { Resend } from "resend";
import { render } from "@react-email/components";
import { DailyEmail } from "@/emails/DailyEmail";
import { buildDailyIssue, SITE_URL, type DailyIssue } from "./daily";

export function newsletterConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_SEGMENT_ID && process.env.NEWSLETTER_FROM);
}

let resend: Resend | null = null;
const client = () => (resend ??= new Resend(process.env.RESEND_API_KEY));

/** Building an issue costs a board read + one Sonnet call; reuse it for 10 minutes. */
let cached: { at: number; issue: DailyIssue } | null = null;
export async function todaysIssue({ fresh = false }: { fresh?: boolean } = {}): Promise<DailyIssue> {
  if (!fresh && cached && Date.now() - cached.at < 10 * 60_000) return cached.issue;
  const issue = await buildDailyIssue();
  cached = { at: Date.now(), issue };
  return issue;
}

export async function renderIssueHtml(issue: DailyIssue): Promise<string> {
  return render(<DailyEmail issue={issue} siteUrl={SITE_URL} address={process.env.NEWSLETTER_ADDRESS} />);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (s: string) => EMAIL_RE.test(s) && s.length <= 254;

/** Add a subscriber to the Daily segment. Re-subscribing an existing address is fine. */
export async function subscribe(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client().contacts.create({
    email,
    unsubscribed: false,
    segments: [{ id: process.env.RESEND_SEGMENT_ID! }],
  });
  if (error && !/already exists/i.test(error.message)) return { ok: false, error: error.message };
  return { ok: true };
}

/** Send one issue to the whole segment as a Resend broadcast. */
export async function sendIssue(issue: DailyIssue): Promise<{ id: string }> {
  const { data, error } = await client().broadcasts.create({
    segmentId: process.env.RESEND_SEGMENT_ID!,
    from: process.env.NEWSLETTER_FROM!,
    subject: issue.subject,
    html: await renderIssueHtml(issue),
    name: `HedgePredict Daily ${issue.date}`,
    send: true,
  });
  if (error || !data) throw new Error(error?.message ?? "Broadcast failed");
  return { id: data.id };
}
