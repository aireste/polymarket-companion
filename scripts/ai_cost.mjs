// What the site's AI features cost, per day and feature, from the ai_usage table.
// npm run ai:cost            (last 14 days)
// npm run ai:cost -- 30      (last 30 days)
import { neon } from "@neondatabase/serverless";

const days = Number(process.argv[2]) || 14;
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  select to_char(at at time zone 'America/New_York', 'YYYY-MM-DD') as day, feature,
         count(*)::int as calls, sum(web_searches)::int as searches,
         sum(input_tokens)::int as input, sum(output_tokens)::int as output,
         coalesce(sum(cost_usd), 0)::float as usd
  from ai_usage where at > now() - make_interval(days => ${days})
  group by 1, 2 order by 1 desc, usd desc`;
if (!rows.length) { console.log(`No AI calls logged in the last ${days} days.`); process.exit(0); }
let day = "", total = 0, grand = 0;
const line = (r) => `  ${r.feature.padEnd(13)} ${String(r.calls).padStart(4)} calls ${String(r.searches).padStart(4)} searches ${String(r.input).padStart(9)} in ${String(r.output).padStart(8)} out   $${r.usd.toFixed(3)}`;
for (const r of rows) {
  if (r.day !== day) { if (day) console.log(`  ${"".padEnd(58)} day total $${total.toFixed(3)}\n`); day = r.day; total = 0; console.log(day + " (ET)"); }
  console.log(line(r)); total += r.usd; grand += r.usd;
}
console.log(`  ${"".padEnd(58)} day total $${total.toFixed(3)}\n\n${days}-day total: $${grand.toFixed(2)}`);
