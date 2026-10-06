import type { Metadata } from "next";
import { connection } from "next/server";
import { unstable_cache } from "next/cache";
import { getTrackRecord } from "@/lib/trackRecord";
import { getCallMatrix } from "@/lib/callHistory";
import { TrackRecordView } from "@/components/TrackRecord";

// Built but not announced: nothing links here and search engines are asked to skip it, until
// enough calls have resolved for the numbers to mean something.
export const metadata: Metadata = {
  title: "Track record · HedgePredict",
  description: "Every Wager and Lean HedgePredict has made, graded when the market resolves.",
  robots: { index: false, follow: false },
};

const cached = unstable_cache(getTrackRecord, ["track-record", "v6"], { revalidate: 300 });
const cachedMatrix = unstable_cache(() => getCallMatrix(), ["call-matrix", "v1"], { revalidate: 120 });

export default async function Page() {
  await connection();
  const [record, matrix] = await Promise.all([cached().catch(() => null), cachedMatrix().catch(() => null)]);
  return (
    <div className="hp-page">
      {record ? <TrackRecordView record={record} matrix={matrix} /> : <p className="hp-empty">The track record isn&apos;t available right now. Try again in a minute.</p>}
    </div>
  );
}
