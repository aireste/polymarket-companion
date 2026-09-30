import type { PlayDTO } from "@/lib/dto";
import { isLive } from "@/lib/format";
import { Countdown } from "./Countdown";
import { Icon } from "./icons";

/** "LIVE" with a pulse, or a clock + countdown ("in 29 days"). */
export function Status({ play, now, icon = false }: { play: PlayDTO; now: number; icon?: boolean }) {
  const live = isLive(play.gameStartTime, now);
  return (
    <span className={`hp-status${live ? " is-live" : ""}`}>
      {live ? <span className="hp-live-dot" aria-hidden /> : icon && <span className="hp-status-ico">{Icon.clock}</span>}
      {live ? "LIVE" : <Countdown play={play} />}
    </span>
  );
}
