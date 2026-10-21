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
// X counts every link as 23 characters, whatever its length.
const xLen = (t) => t.replace(/https?:\/\/\S+/g, "x".repeat(23)).length;
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
  const p = pct(side.price);
  // Always name the side Jev likes and ITS price, then say what that means, so a "No" is never misread as backing the thing named.
  const meaning = side.label === "No"
    ? `Jev thinks No is more likely than the market's ${p}, so it thinks this is less likely to happen than the market does.`
    : `Jev thinks ${side.label} is more likely than the market's ${p}.`;
  const draft = [
    `${CALL[r.action]}: ${side.label} at ${Math.round(side.price * 100)}¢`,
    r.marketName,
    meaning,
    `Decision support, not advice.\n${SITE}/share/${encodeURIComponent(r.marketId)}`,
  ].join("\n\n");
  if (SEND) {
    const link = "https://x.com/intent/post?text=" + encodeURIComponent(draft);
    const msg = `X draft ${i + 1} of ${calls.length}\n\n${draft}\n\nTap to open in X, edit, post:\n${link}`;
    execFileSync("ssh", ["agent@134.209.112.34", "notify-esteban"], { input: msg, stdio: ["pipe", "inherit", "inherit"] }); // message goes over stdin so the remote shell never parses it
  }
  console.log(`--- Draft ${i + 1} (${xLen(draft)} chars on X${xLen(draft) > 280 ? ", OVER 280, trim" : ""}) ---\n${draft}\n`);
});
console.log(SEND ? "Queued to Telegram. Nothing was posted." : "Review every draft. Post only calls made before the event. Nothing was posted.");
