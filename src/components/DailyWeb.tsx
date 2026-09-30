import Link from "next/link";
import type { DailyIssue, IssueMarket } from "@/lib/daily";
import { SubscribeBox } from "./SubscribeBox";
import { Icon } from "./icons";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const verb = (a: string) => (a === "wager" ? "Back" : "Lean");

/**
 * The Daily on the web: the same issue subscribers get, laid out for a screen
 * (full width, two columns) instead of an email's 600px column. Rows open the
 * market on the board.
 */
export function DailyWeb({ issue }: { issue: DailyIssue }) {
  const { pick, counts } = issue;
  const updated = new Date(issue.generatedAt).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
  const boardLine =
    [counts.wager && `Jev backs ${counts.wager}`, counts.lean && `${counts.wager ? "leans on" : "Jev leans on"} ${counts.lean}`]
      .filter(Boolean)
      .join(" · ") || "No calls";

  return (
    <div className="hp-dw">
      <header className="hp-dw-head">
        <div className="hp-dw-title">
          <span className="hp-dw-brand">HedgePredict Daily</span>
          <h1>{issue.title}</h1>
          <p className="hp-dw-meta">2-minute read · live, updated {updated} ET · the email goes out weekdays at 8 AM ET</p>
          {issue.intro && <p className="hp-dw-intro">{issue.intro}</p>}
        </div>
        <SubscribeBox source="daily-page" />
      </header>

      <div className="hp-dw-grid">
        <div className="hp-dw-col">
          <Section n="01" title="Today's pick">
            {pick?.call ? (
              <div className="hp-dw-pick featured">
                <span className={`hp-pick-tag ${pick.call.action === "wager" ? "wager" : "hold"}`}>
                  <i aria-hidden />
                  {pick.call.action === "wager" ? "Wager" : "Lean"}
                </span>
                <h2>
                  {verb(pick.call.action)} <em>{pick.call.side}</em> at <span className="num">{pct(pick.call.sidePrice)}</span>
                </h2>
                <p className="hp-dw-pick-q">{pick.question}</p>
                <p className="hp-dw-pick-meta">
                  Jev {pct(pick.call.strength)} on this side
                  {pick.call.confidence != null ? ` · ${pct(pick.call.confidence)} confidence` : ""} · resolves {pick.when}
                </p>
                <div className="hp-dw-pick-actions">
                  <Link href={`/?m=${pick.id}`} className="hp-pick-open">
                    Open on the board
                  </Link>
                  <a href={pick.url} target="_blank" rel="noopener noreferrer" className="hp-pick-trade">
                    <span className="hp-pm-tile">{Icon.polymarket}</span>
                    Trade ↗
                  </a>
                </div>
              </div>
            ) : (
              <p className="hp-dw-empty">
                <b>No standout play today.</b> Jev sees the board as fairly priced. Sitting out is a position.
              </p>
            )}
          </Section>

          <Section n="02" title="Jev's board" aside={`${boardLine} · ${counts.skip} look priced right`}>
            {issue.leans.length === 0 ? (
              <p className="hp-dw-empty">No other leans right now.</p>
            ) : (
              <ul className="hp-dw-list">
                {issue.leans.map((m) => (
                  <Row key={m.id} m={m}>
                    <span className="hp-dw-call">
                      <i className={m.call!.action === "wager" ? "wager" : "hold"} aria-hidden />
                      <span>
                        {verb(m.call!.action)} <b>{m.call!.side}</b> at {pct(m.call!.sidePrice)}
                      </span>
                    </span>
                    <span className="hp-dw-q">{m.question}</span>
                    <span className="hp-dw-right num">Jev {pct(m.call!.strength)}</span>
                  </Row>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="hp-dw-col">
          <Section n="03" title="On the clock" aside="next 24 hours">
            {issue.onTheClock.length === 0 ? (
              <p className="hp-dw-empty">Nothing on the board resolves in the next 24 hours.</p>
            ) : (
              <ul className="hp-dw-list">
                {issue.onTheClock.map((m) => (
                  <Row key={m.id} m={m} lead={m.when}>
                    <span className="hp-dw-q strong">{m.question}</span>
                    <span className="hp-dw-right">{m.call ? `${m.call.action === "wager" ? "Wager" : "Lean"} · ${m.call.side}` : "Skip"}</span>
                  </Row>
                ))}
              </ul>
            )}
          </Section>

          <Section n="04" title="Movers" aside="last 24 hours">
            {issue.movers.length === 0 ? (
              <p className="hp-dw-empty">A quiet day: nothing moved more than 2 points.</p>
            ) : (
              <ul className="hp-dw-list">
                {issue.movers.map((m) => (
                  <Row
                    key={m.id}
                    m={m}
                    lead={`${m.move24h! >= 0 ? "▲" : "▼"} ${Math.abs(m.move24h! * 100).toFixed(1)}`}
                    leadTone={m.move24h! >= 0 ? "up" : "dn"}
                  >
                    <span className="hp-dw-q strong">{m.question}</span>
                    <span className="hp-dw-right num">
                      {m.outcome.length <= 10 ? `${m.outcome} ` : ""}
                      {pct(m.price)}
                    </span>
                  </Row>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <p className="hp-disc hp-dw-disc">
        Jev reads prices, recent price moves, volume and timing, not news. Decision support, not financial advice;
        HedgePredict never places trades.
      </p>
    </div>
  );
}

function Section({ n, title, aside, children }: { n: string; title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="hp-dw-sec">
      <h3 className="hp-dw-label">
        <span>{n}</span>
        {title}
        {aside && <small>{aside}</small>}
      </h3>
      {children}
    </section>
  );
}

function Row({
  m,
  lead,
  leadTone,
  children,
}: {
  m: IssueMarket;
  lead?: string;
  leadTone?: "up" | "dn";
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link href={`/?m=${m.id}`} className={`hp-dw-row${lead ? " has-lead" : ""}`}>
        {lead && <span className={`hp-dw-lead num${leadTone ? ` ${leadTone}` : ""}`}>{lead}</span>}
        <span className="hp-dw-body">{children}</span>
      </Link>
    </li>
  );
}
