import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { cachedPreview } from "@/lib/dailyPreview";
import { SubscribeBox } from "@/components/SubscribeBox";
import { EmailPreview, EmailPreviewSkeleton } from "@/components/EmailPreview";
import Link from "next/link";
import { TipLine } from "@/components/TipLine";

export const metadata: Metadata = {
  title: "HedgePredict Daily",
  description: "A 2-minute read on prediction markets: the day's pick, a few plays worth a look, and the week ahead. Weekdays at 8 AM ET.",
};

// Reads the latest saved issue. Only the very first issue ever is built here (about a minute).
export const maxDuration = 300;

const INSIDE = [
  { n: "01", k: "The play", p: "Our strongest call of the day, and the case for it in plain words." },
  { n: "02", k: "Around the markets", p: "A couple of plays each from sports, politics, economy and crypto, and culture, with a short note on why." },
  { n: "03", k: "What we're passing on", p: "One popular market we think is priced fair, and why we're leaving it alone." },
  { n: "04", k: "The week ahead", p: "The games, votes and deadlines coming up that will move prices." },
];

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
        <h1>
          <span className="hp-name">HedgePredict</span> Daily
        </h1>
        <p className="hp-dl-lede">
          What&apos;s worth a look in prediction markets today, written like a friend catching you up: the day&apos;s pick, a few plays across sports, politics, crypto and culture, and the week ahead. In your inbox every weekday at 8 AM ET. A 2-minute read.
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
        <p className="hp-dl-note">The preview is the latest issue, exactly as it landed in inboxes. The board has every market, live; the Daily is the read.</p>
        <TipLine />
      </div>

      <div className="hp-dl-preview">
        <Suspense fallback={<EmailPreviewSkeleton />}>
          <Preview />
        </Suspense>
      </div>
    </div>
  );
}
