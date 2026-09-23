# HedgePredict — Product Context

register: product

## Product purpose
A prediction-market **companion** for Polymarket. It answers one question fast:
"what are the best plays today, and where's the value?" It surfaces live markets
worth a look (momentum, liquidity, uncertainty, time-to-resolution), and — when
asked — turns a probability read (yours, or Claude's) into a measured edge, a
fractional-Kelly stake suggestion, and a hedge leg. It is decision support, not a
tipster and not a trade-executor. It never fabricates "guaranteed value": when
there's no edge, it says so.

## Users
- Primary: Esteban — building this as a Handshake AI-builder portfolio piece to
  demonstrate real skill with live APIs, LLM orchestration, and MCP. Uses it
  himself to decide where to hedge ~$50 without drowning in market options.
- Secondary: people he shares the app with (Handshake reviewers, friends) who
  open it cold on **phone or laptop** and must "get it" in seconds. Multi-device,
  multi-location, quick glances a few times a day.

## Tone & principles
- **Honest over hype.** The tool's credibility is the product. Confidence is shown
  plainly (low/med/high); "no edge → don't bet" is a feature, not a gap.
- **Glanceable & calm.** A few focused decisions, fast. Not a wall of blinking data.
- **Professional, credible, distinctive.** Should look like a considered product a
  smart person built, not a template.
- **Trustworthy with money framing.** No pressure tactics, no "you'll win" language.
  Fractional-Kelly and hedges are about capping downside.

## Anti-references (what it must NOT look/feel like)
- Generic AI-slop SaaS dashboard: identical icon-heading-text card grids, a hero
  metric with a gradient accent, purple-on-dark gradients, Inter-everywhere.
- Crypto/betting cliché: neon-on-black, casino energy, hype green "TO THE MOON".
- Fintech cliché: navy + gold "serious money" costume.
- Anything that reads as "an AI generated this."

## Strategic notes
- The signal ranker and edge/hedge math are real (`src/lib/scoring.ts`); the UI's
  job is to make them legible and trustworthy, not decorate them.
- Two front doors planned: this web dashboard, and an MCP server so Claude can
  query the same engine. Keep the visual identity coherent enough to carry over.
