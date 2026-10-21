// Drafts X posts from Jev's live board. Never posts anything: it only prints drafts for Esteban to review.
// Usage: node scripts/draft_posts.mjs [--site https://hedgepredict.co] [--n 3]
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const SITE = arg("--site", "https://hedgepredict.co");
const N = Number(arg("--n", 3));

const board = await (await fetch(`${SITE}/api/jev/board`)).json();
const CALL = { wager: "Wager", hold: "Lean" };
const pct = (p) => `${Math.round(p * 100)}%`;

const calls = Object.values(board.reads)
  .filter((r) => !r.settled && r.lean != null && CALL[r.action])
  .sort((a, b) => (b.action === "wager") - (a.action === "wager") || b.strength - a.strength)
  .slice(0, N);

if (!calls.length) {
  console.log("No Wager or Lean on the board right now. Nothing worth posting today.");
  process.exit(0);
}

calls.forEach((r, i) => {
  const side = r.sides[r.lean];
  const draft = [
    `${CALL[r.action]}: ${r.marketName}`,
    `Jev's read is ${side.label}. Polymarket has it at ${pct(side.price)}.`,
    `Decision support, not advice. Full record, losses included: ${SITE}/track-record`,
  ].join("\n\n");
  console.log(`--- Draft ${i + 1} (${draft.length} chars${draft.length > 280 ? ", OVER 280, trim" : ""}) ---\n${draft}\n`);
});
console.log("Review every draft. Post only calls made before the event. Nothing was posted.");
