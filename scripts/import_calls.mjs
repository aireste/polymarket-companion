// One-off: copy the Mac tracker's calls.csv into the calls table (skips rows already there).
// node --env-file=.env.local scripts/import_calls.mjs "<path to calls.csv>"
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const text = readFileSync(process.argv[2], "utf8");
// Minimal CSV parser (quoted fields with commas / doubled quotes).
const parse = (s) => {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
};
const [head, ...body] = parse(text);
const ts = (v) => (v ? new Date(v.replace(" UTC", "Z").replace(" ", "T")).toISOString() : null);
const num = (v) => (v === "" ? null : Number(v));
let n = 0;
for (const r of body.filter((r) => r.length === head.length)) {
  const o = Object.fromEntries(head.map((h, i) => [h, r[i]]));
  const res = await sql`
    insert into calls (logged_at, market_id, question, call, side, side_price, how_sure, confidence,
      resolves_at, phase, result, resolved_at, profit, model)
    values (${ts(o.logged_at)}, ${o.market_id}, ${o.question}, ${o.call}, ${o.side}, ${num(o.side_price)},
      ${num(o.how_sure)}, ${num(o.confidence)}, ${o.resolves_at || null}, ${o.phase || null}, ${o.result},
      ${ts(o.resolved_at)}, ${num(o["profit_per_$1"])}, ${o.model})
    on conflict do nothing returning id`;
  n += res.length;
}
console.log(`imported ${n} of ${body.length} rows`);
