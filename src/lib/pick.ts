/**
 * Today's pick: Jev's strongest call on the board. A Wager beats any Lean;
 * within a tier, the stronger lean wins. Decided markets never qualify, and on
 * a board with no Wager or Lean there is no pick (the UI says so honestly).
 */
import type { JevReadDTO, PlayDTO } from "./dto";

export interface Pick {
  play: PlayDTO;
  read: JevReadDTO;
}

const TIER = { wager: 2, hold: 1, skip: 0 } as const;

export function todaysPick(plays: PlayDTO[] | null, reads: Record<string, JevReadDTO>): Pick | null {
  let best: Pick | null = null;
  for (const play of plays ?? []) {
    const read = reads[play.id];
    if (!read || read.settled || read.action === "skip" || read.lean == null) continue;
    if (
      !best ||
      TIER[read.action] > TIER[best.read.action] ||
      (TIER[read.action] === TIER[best.read.action] && read.strength > best.read.strength)
    ) {
      best = { play, read };
    }
  }
  return best;
}
