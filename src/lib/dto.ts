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
  volume: number;
  volume24hr: number;
  liquidity: number;
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
  outcome: string;
  marketPrice: number;
  jevProbability: number;
  edge: number;
  action: "wager" | "hold" | "skip";
  actionProbabilities?: Record<string, number>;
  valuation: "undervalued" | "fair" | "overvalued";
  confidence: number | null;
  model: string;
}

/** `available:false` means the gateway key isn't set; `error` means it failed. */
export type JevResponse =
  | JevReadDTO
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
