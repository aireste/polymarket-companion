# HedgePredict

A decision-support **companion for Polymarket** that answers one question fast:
_"What are the best plays today, and where's the value?"_

It surfaces live prediction markets worth a look, and — when asked — turns a
probability read (yours, or Claude's) into a measured edge, a fractional-Kelly
stake suggestion, and a hedge that caps your downside.

> It is decision support, not a tipster and not a trade-executor. It never
> fabricates "guaranteed value": when a market looks efficient, it says so.

---

## Why this project exists

I built HedgePredict to work hands-on with the stack modern AI products are made
of: **live third-party APIs, LLM orchestration, and the Model Context Protocol
(MCP)**. It exposes one engine through **two front doors**:

1. **A web dashboard** — open it, glance at the ranked plays, dig into one.
2. **A hosted MCP server** — connect your own AI assistant (Claude Desktop,
   Claude Code, claude.ai) and ask it directly: _"What are the best Polymarket
   plays today?"_ Your assistant calls this app's engine live, no website needed.

Both doors run the exact same core logic — the UI and the MCP server are thin
layers over one shared engine in [`src/lib`](src/lib).

---

## What it does

- **Ranks live markets** by a transparent blend of signals — momentum (24h
  volume), liquidity, uncertainty (price entropy), and time-to-resolution — so
  you're not paralyzed by thousands of markets.
- **Gives an honest AI read.** Given a market, Claude checks live news and
  sentiment via web search, estimates a true probability, compares it to the
  market price, and returns a strict **CHASE / HOLD / SKIP** call with
  confidence and rationale. Efficient markets get HOLD or SKIP by design.
- **Sizes the play.** Converts a probability estimate into edge, a
  fractional-Kelly stake (clamped for safety), expected value, and a hedge leg —
  all traceable back to a stated belief, with no invented "true odds."

---

## Architecture

```
                 ┌─────────────────────────────┐
   Web browser ─▶│  Next.js dashboard (src/app) │─┐
                 └─────────────────────────────┘ │
                                                  ├─▶  Shared engine (src/lib)
   Any MCP    ─▶ ┌─────────────────────────────┐ │     • polymarket.ts  (Gamma API client)
   client        │  MCP server (api/mcp)        │─┘     • scoring.ts     (rank + edge/Kelly/hedge)
   (Claude)      └─────────────────────────────┘       • recommend.ts   (Claude + web search)
```

**The engine — [`src/lib`](src/lib)**
- `polymarket.ts` — typed client for Polymarket's Gamma API; normalizes messy
  JSON-encoded fields into safe `Market` objects.
- `scoring.ts` — the signal ranker and the edge/Kelly/hedge math (pure functions,
  no I/O).
- `recommend.ts` — the autonomous CHASE/HOLD/SKIP engine (Claude + live web
  search, structured JSON output).

**Front door 1 — the dashboard ([`src/app`](src/app), [`src/components`](src/components))**
A Next.js App Router dashboard. REST route handlers under `src/app/api`
(`/plays`, `/v2/recommendations`, `/history`, `/read`) serve the UI.

**Front door 2 — the MCP server ([`src/app/api/mcp`](src/app/api/mcp/route.ts))**
A hosted, Streamable-HTTP MCP server built on `mcp-handler` v2. It exposes four
tools that wrap the same engine:

| Tool | What it does |
|---|---|
| `get_best_plays` | Ranked markets worth a look (filters: all / hot / coinflip / soon) |
| `recommend_market` | Claude's CHASE/HOLD/SKIP read for one market (uses live web search) |
| `analyze_edge` | Edge, fractional-Kelly stake, and hedge math — pure, no LLM call |
| `get_market_history` | Price/implied-probability history for one outcome |

---

## Tech stack

- **Next.js 16** (App Router, route handlers) + **React 19** + **TypeScript**
- **Anthropic SDK** (`@anthropic-ai/sdk`) — Claude with structured outputs and
  the web-search tool
- **MCP** — `mcp-handler` v2 + `@modelcontextprotocol/server` v2, `zod` v4
- **Polymarket** Gamma API (markets) and CLOB API (price history)
- **Tailwind CSS v4**

---

## Running it locally

Requires **Node.js 20+**.

```bash
git clone git@github.com:aireste/polymarket-companion.git
cd polymarket-companion
npm install
```

Create a `.env.local` with your Anthropic key (the AI features degrade gracefully
without it — you can still rank markets and run the edge math manually):

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Then start the dev server:

```bash
npm run dev
```

Open http://localhost:3000 for the dashboard.

### Trying the MCP server

The MCP server lives at `http://localhost:3000/api/mcp` while `npm run dev` is
running. Point any Streamable-HTTP MCP client at that URL. For example, in Claude
Code:

```bash
claude mcp add --transport http hedgepredict http://localhost:3000/api/mcp
```

Then ask your assistant things like _"Use hedgepredict to show me the best
coinflip markets today"_ or _"Get a recommendation on market <id>."_

---

## A note on honesty

A market's price already reflects the crowd's probability estimate. The tool
treats that as the prior and only claims an edge when there's a concrete reason
to — most efficient markets correctly return HOLD or SKIP. Suggested stakes are
fractional-Kelly and clamped. This is a portfolio and decision-support project,
**not financial advice**, and it does not place trades.
