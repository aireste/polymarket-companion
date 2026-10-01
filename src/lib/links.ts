/**
 * Where people go to trade. Market data comes from international Polymarket
 * (polymarket.com), but US users trade on Polymarket US (polymarket.us), a
 * separate exchange with its own URLs and not every market. So a person's
 * click opens a polymarket.us search for the market: one tap away when it's
 * listed, never a dead link when it isn't. AI tools (MCP, chat) keep the
 * canonical polymarket.com `url`.
 */
export const POLYMARKET_US = "https://polymarket.us";

export function polymarketUs(question: string): string {
  const q = question.replace(/^will\s+/i, "").replace(/\?\s*$/, "").trim().slice(0, 80);
  return q ? `${POLYMARKET_US}/search?q=${encodeURIComponent(q)}` : POLYMARKET_US;
}
