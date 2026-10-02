import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { unstable_cache } from "next/cache";
import { renderIssueHtml, todaysIssue } from "@/lib/newsletter";
import { SubscribeBox } from "@/components/SubscribeBox";
import { EmailPreview, EmailPreviewSkeleton } from "@/components/EmailPreview";
import Link from "next/link";

export const metadata: Metadata = {
  title: "HedgePredict Daily",
  description: "The day's best pick, what resolves next, and the biggest movers. Weekdays at 8 AM ET.",
};

const INSIDE = [
  { n: "01", k: "Today's pick", p: "The strongest call on the board, with the price and how sure we are." },
  { n: "02", k: "The board", p: "Every other market worth a look, in one line each." },
  { n: "03", k: "On the clock", p: "What resolves in the next 24 hours, with times in ET." },
  { n: "04", k: "Movers", p: "The biggest price swings of the last day." },
];

/**
 * Today's rendered issue, shared across server instances for 10 minutes so most
 * visits skip the build (board reads + intro + news), which takes seconds cold.
 */
const cachedPreview = unstable_cache(
  async () => {
    const issue = await todaysIssue();
    return { subject: issue.subject, html: await renderIssueHtml(issue) };
  },
  ["daily-preview"],
  { revalidate: 600 }
);

/** Streams in after the page: the pitch and signup never wait on the issue. */
async function Preview() {
  await connection();
  const p = await cachedPreview().catch(() => null);
  return p ? (
    <EmailPreview html={p.html} subject={p.subject} from="HedgePredict Daily" />
  ) : (
    <p className="hp-empty">Today&apos;s issue isn&apos;t available right now. Try again in a minute.</p>
  );
}

/** The Daily's landing page: the pitch + signup, and today's real email in a mail window. */
export default function Page() {
  return (
    <div className="hp-dl">
      <div className="hp-dl-copy">
        <Link href="/" className="hp-back">‹ Board</Link>
        <h1>HedgePredict Daily</h1>
        <p className="hp-dl-lede">
          The day&apos;s best pick, what&apos;s about to resolve, and the day&apos;s biggest movers. In your inbox every weekday at 8 AM ET. A 2-minute read.
        </p>
        <SubscribeBox source="daily-page" />
        <ol className="hp-dl-inside" aria-label="What's inside">
          {INSIDE.map((x) => (
            <li key={x.n}>
              <span>{x.n}</span>
              <div>
                <b>{x.k}</b>
                <p>{x.p}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="hp-dl-note">The preview is today&apos;s real issue, rendered exactly as it lands in your inbox.</p>
      </div>

      <div className="hp-dl-preview">
        <Suspense fallback={<EmailPreviewSkeleton />}>
          <Preview />
        </Suspense>
      </div>
    </div>
  );
}
