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
 *   FORMSPREE_ENDPOINT   pre-launch waitlist (defaults to our form); used until Resend is set up
 */
import { Resend } from "resend";
import { render } from "@react-email/components";
import { DailyEmail } from "@/emails/DailyEmail";
import { buildDailyIssue, ISSUE_VERSION, SITE_URL, type DailyIssue } from "./daily";

export function newsletterConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_SEGMENT_ID && process.env.NEWSLETTER_FROM);
}

let resend: Resend | null = null;
const client = () => (resend ??= new Resend(process.env.RESEND_API_KEY));

/**
 * The current issue. Building one costs real money (board reads on five boards, web-searched news
 * lookups, a writing pass), so it happens in exactly one place: the weekday 8 AM send, which
 * passes `fresh`. Everyone else (the Daily page, the tour, the preview) reads the latest saved
 * issue from the `issues` table and never triggers a build, so a busy page or a crawler costs
 * nothing. On a weekend, or before 8 AM, "the current issue" is simply the last one sent.
 * The only other build is the very first one, when no issue has ever been saved.
 */
let building: Promise<DailyIssue> | null = null;

async function latestIssue(): Promise<DailyIssue | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import("@/db");
    const { issues } = await import("@/db/schema");
    const { desc } = await import("drizzle-orm");
    const rows = await db.select().from(issues).orderBy(desc(issues.date)).limit(5);
    const hit = rows.map((r) => r.issue as DailyIssue).find((i) => i?.v === ISSUE_VERSION);
    return hit ?? null;
  } catch {
    return null;
  }
}

async function saveIssue(issue: DailyIssue): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const { db } = await import("@/db");
    const { issues } = await import("@/db/schema");
    await db
      .insert(issues)
      .values({ date: issue.date, issue, generatedAt: new Date(issue.generatedAt) })
      .onConflictDoUpdate({ target: issues.date, set: { issue, generatedAt: new Date(issue.generatedAt) } });
  } catch {
    /* the issue still goes out; it just isn't saved */
  }
}

export async function todaysIssue({ fresh = false }: { fresh?: boolean } = {}): Promise<DailyIssue> {
  if (!fresh) {
    const saved = await latestIssue();
    if (saved) return saved;
    // Nothing saved yet: build once. Readers arriving together share that one build.
    if (building) return building;
  }
  building = (async () => {
    try {
      const issue = await buildDailyIssue();
      await saveIssue(issue);
      return issue;
    } finally {
      building = null;
    }
  })();
  return building;
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

/** Pre-launch: signups land in a Formspree waitlist until Resend is configured. */
const FORMSPREE = process.env.FORMSPREE_ENDPOINT ?? "https://formspree.io/f/mljdvoyo";

export async function joinWaitlist(email: string, source: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(FORMSPREE, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email, source, _subject: "New HedgePredict Daily signup" }),
    });
    if (res.ok) return { ok: true };
    const d = (await res.json().catch(() => ({}))) as { errors?: { message?: string }[] };
    return { ok: false, error: d.errors?.[0]?.message ?? `Formspree returned ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Waitlist unreachable" };
  }
}
