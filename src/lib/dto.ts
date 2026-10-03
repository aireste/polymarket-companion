/**
 * Wire types shared between the API routes and the client.
 * Dates cross the wire as ISO strings, so these mirror the lib types with
 * `endDate` serialized. Kept dependency-free so the client can import them.
 */
import type { Signals } from "./scoring";

export interface OutcomeDTO {
  label: string;
  price: number;
  tokenId?: string;
}

export interface HistoryPoint {
  /** Unix seconds. */
  t: number;
  /** Price / implied probability in [0,1]. */
  p: number;
}

export interface PlayDTO {
  id: string;
  question: string;
  url: string;
  imageUrl: string | null;
  outcomes: OutcomeDTO[];
  /** Lifetime $ traded; null when not looked up (Polymarket US only shows it per market). */
  volume: number | null;
  /** Always null on Polymarket US (it doesn't publish 24h volume). */
  volume24hr: number | null;
  /** $ order-book depth near the price; null when not looked up. */
  liquidity: number | null;
  /** Bid/ask spread on the first outcome, 0..1; null if unknown. */
  spread: number | null;
  /** Polymarket US category ("sports", "politics", …); null if unknown. */
  category: string | null;
  endDate: string | null;
  /** ISO game start time for scheduled markets; null otherwise. */
  gameStartTime: string | null;
  score: number;
  signals: Signals;
}

export type AiAction = "CHASE" | "HOLD" | "SKIP";

/** Standardized V2 recommendation payload (POST /api/v2/recommendations). */
export interface RecommendationDTO {
  marketId: string;
  marketName: string;
  currentOdds: { label: string; price: number }[];
  endDate: string | null;
  gameStartTime: string | null;
  aiAction: AiAction;
  confidence: "low" | "medium" | "high";
  aiProbability: number;
  crowdSentimentSummary: string;
  actionRationale: string;
  model: string;
}

/** Jev's calibrated read (POST /api/jev). */
export interface JevReadDTO {
  marketId: string;
  marketName: string;
  /** The market's outcomes and their current prices, in [0,1]. */
  sides: { label: string; price: number }[];
  /** Index into `sides` of the side Jev leans toward; null = priced about right. */
  lean: number | null;
  /** Jev's probability on its answer: the leaned side, or "neither" on a skip. */
  strength: number;
  /** Jev's full distribution: one entry per side, plus "neither". */
  distribution: { sides: number[]; neither: number };
  action: "wager" | "hold" | "skip";
  /** Calibrated confidence, [0,1]; null if not returned. */
  confidence: number | null;
  /** One side is at >= 97%: effectively decided, no call made. */
  settled?: boolean;
  model: string;
}

/** `available:false` means the TypeSafe key isn't set; `error` means it failed. */
export type JevResponse =
  | JevReadDTO
  | { available: false; reason: string }
  | { error: string };

/** Claude's plain-language explanation of Jev's call (POST /api/jev/explain). */
export interface JevExplainDTO {
  explanation: string;
  model: string;
}

/** `available:false` means no Anthropic key; `error` means the call failed. */
export type JevExplainResponse =
  | JevExplainDTO
  | { available: false; reason: string }
  | { error: string };

/** `available:false` means no API key; `error` means the call failed. */
export type RecommendationResponse =
  | RecommendationDTO
  | { available: false; reason: string }
  | { error: string };

/** Response from POST /api/read. `available:false` means no API key configured. */
export type ReadResponse =
  | {
      available: true;
      outcome: string;
      marketPrice: number;
      probability: number;
      confidence: "low" | "medium" | "high";
      rationale: string;
      model: string;
    }
  | { available: false; reason: string };

/** GET /api/jev/board: Jev's read on every board market, keyed by market id. */
export type JevBoardResponse =
  | { reads: Record<string, JevReadDTO>; asOf: string }
  | { available: false; reason: string }
  | { error: string };
