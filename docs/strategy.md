# HedgePredict: monetization and next steps

Written 2026-10-03 from a read of the code at that date. This is ideation, not a
commitment. The track-record logger and weekly metrics are handled separately
(the logger currently runs on the author's Mac and is not in this repo).

## Where things stand

- Engine (`src/lib`): signal ranker and edge/Kelly/hedge math (`scoring.ts`),
  Jev calibrated calls (`jev.ts`), Claude web-grounded deep read (`recommend.ts`).
- Front doors: Next.js dashboard (board, inspector, Hedge Lab sandbox, Ask chat,
  tour) and a hosted MCP server at `/api/mcp` with 5 tools.
- Daily email (HedgePredict Daily) sent weekdays 8 AM ET through Resend.
- Missing for a business: accounts, a database, payments, a shared rate limiter,
  tests.

## Monetization ideas, in the order to try them

1. **Track record first (free).** A verifiable, public record of calls is the
   moat. Without it a paid tier is a paywall on opinions.
2. **Pro tier, roughly $8-15/mo.**
   - Unlimited deep reads (the real marginal cost: Opus + web search is about
     15-25 cents per read, so Pro still needs a usage cap).
   - Saved boards and watchlists.
   - Price and edge alerts by email or push.
   - Hedge Lab with saved slips and history.
   - Higher MCP rate limits and a personal API key.
   - Early access to the daily picks.
   Free tier keeps the daily email, the board, and 3 deep reads a day.
3. **MCP / API access for AI users.** Few Polymarket tools offer a hosted MCP.
   Sell API keys with usage-based pricing to developers and agent builders.
4. **Affiliate or referral links.** Check Polymarket's current referral and
   builder program terms first. Disclose clearly; hidden referrals conflict with
   the "decision support, not a tipster" stance.
5. **Newsletter sponsorship.** Only after a few thousand engaged subscribers.

## Risks to resolve before charging

- **Regulation.** Polymarket availability and rules differ by country and U.S.
  state, and charging for "picks" can look like selling betting advice. Keep the
  "decision support, not advice" framing prominent and get advice from someone
  qualified before taking payments.
- **Cost per user.** Cap expensive calls server-side per account.
- **Upstream dependencies.** Polymarket Gamma API, Anthropic, and TypeSafe (Jev)
  are all single points of failure.

## Marketing

- Business card: `hedgepredict.co` plus a QR code to the live demo or the
  connect-your-AI page; tagline "Ask your AI for today's best Polymarket plays."
- Channels: the 1:30 tour video on X and prediction-market communities, a
  "Show HN" post, an MCP directory listing, and the daily newsletter (put the
  signup box on the tour and README).
- Handshake framing: a case study in live APIs, a calibrated model plus an LLM,
  and a hosted MCP, backed by a public scoreboard.

## Next step: database and accounts

The product currently has no persistence and no users. Everything that makes it
a business hangs on this layer.

1. **Pick a database.** Vercel Postgres (or Neon) for relational data; Vercel KV
   or Upstash Redis if only counters and sessions are needed. Likely both:
   Postgres for users and records, Redis for rate limits.
2. **Accounts and login.** Email magic link (the Resend setup already exists) or
   OAuth, through Auth.js or a hosted option such as Clerk. Store: user,
   subscription tier, API keys.
3. **Payments.** Stripe Checkout and the customer portal, with webhooks that set
   the user's tier. Server-side entitlement checks, never client-only.
4. **Real rate limiting.** Replace the in-memory limiter in
   `src/lib/rateLimit.ts` with a shared store, keyed by user id when logged in
   and by IP when anonymous. This turns the free/Pro limits into real gates.
5. **Move the track-record logger to the cloud.** Persist calls and outcomes in
   the database, with a Vercel cron to log new picks and settle resolved
   markets, so the record no longer depends on the author's Mac being on.
6. **Saved state.** Boards, watchlists, Hedge Lab slips tied to the account.
7. **Tests.** At minimum for `scoring.ts` and `lab.ts`: this is money math, and a
   bug there costs trust.
8. **Housekeeping.** Refresh `PROJECT_NOTES.md`, which still says "Scaffolding
   pending."

## Suggested order

Database -> accounts -> shared rate limiter -> cloud logger -> Stripe + Pro tier
-> MCP/API keys -> marketing push. Tests and notes cleanup can go in alongside
the first step.
