// Who has joined the Daily, from the `subscribers` table (a copy of the Resend list that the
// live site refreshes every 30 minutes).
// npm run subs          (totals + the 15 most recent)
// npm run subs -- 50    (the 50 most recent)
import { neon } from "@neondatabase/serverless";

const show = Number(process.argv[2]) || 15;
const sql = neon(process.env.DATABASE_URL);
const [t] = await sql`
  select count(*) filter (where not unsubscribed)::int as active,
         count(*) filter (where unsubscribed)::int as unsubscribed,
         count(*) filter (where not unsubscribed and joined_at > now() - interval '7 days')::int as week,
         count(*) filter (where not unsubscribed and joined_at > now() - interval '1 day')::int as day,
         max(synced_at) as synced
  from subscribers`;
if (!t.synced) { console.log("No subscribers recorded yet. The live site copies the list every 30 minutes; try again shortly."); process.exit(0); }
const et = (d) => new Date(d).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
console.log(`HedgePredict Daily subscribers (list last refreshed ${et(t.synced)} ET)\n`);
console.log(`  Subscribed now:   ${t.active}`);
console.log(`  Joined last 24h:  ${t.day}`);
console.log(`  Joined last 7d:   ${t.week}`);
console.log(`  Unsubscribed:     ${t.unsubscribed}\n`);
const rows = await sql`select email, joined_at, unsubscribed, source from subscribers order by joined_at desc limit ${show}`;
console.log(`Most recent ${rows.length}:`);
for (const r of rows) console.log(`  ${et(r.joined_at).padEnd(18)} ${r.email.padEnd(34)} ${(r.source ?? "").padEnd(18)}${r.unsubscribed ? " (unsubscribed)" : ""}`);
