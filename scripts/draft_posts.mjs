// Drafts X posts from Jev's live board. Never posts anything: it only prints drafts for Esteban to review.
// Usage: node scripts/draft_posts.mjs [--site https://hedgepredict.co] [--n 3] [--send]
// --send queues each draft to Esteban on Telegram (via the server's notify-esteban) with a tap-to-compose X link.
// X opens with the text filled in; he edits and posts. The pasted site link shows the HedgePredict card as the image.
import { execFileSync } from "node:child_process";
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const SITE = arg("--site", "https://hedgepredict.co");
const N = Number(arg("--n", 3));
const SEND = process.argv.includes("--send");

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
  if (SEND) {
    const link = "https://x.com/intent/post?text=" + encodeURIComponent(draft);
    const msg = `X draft ${i + 1} of ${calls.length}\n\n${draft}\n\nTap to open in X, edit, post:\n${link}`;
    execFileSync("ssh", ["agent@134.209.112.34", "notify-esteban"], { input: msg, stdio: ["pipe", "inherit", "inherit"] }); // message goes over stdin so the remote shell never parses it
  }
  console.log(`--- Draft ${i + 1} (${draft.length} chars${draft.length > 280 ? ", OVER 280, trim" : ""}) ---\n${draft}\n`);
});
console.log(SEND ? "Queued to Telegram. Nothing was posted." : "Review every draft. Post only calls made before the event. Nothing was posted.");
