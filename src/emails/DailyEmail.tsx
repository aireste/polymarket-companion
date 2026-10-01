/**
 * HedgePredict Daily, the email. React Email components render to
 * table-based HTML with inline styles that survive Gmail, Apple Mail and
 * Outlook. Brand colors are the site's OKLCH tokens converted to hex (email
 * clients don't support oklch).
 */
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { DailyIssue, IssueMarket } from "@/lib/daily";
import { polymarketUs } from "@/lib/links";

const C = {
  canvas: "#eef0f3",
  card: "#fdfdfe",
  ink: "#1b1d22",
  soft: "#5c6068",
  faint: "#8a8e96",
  rule: "#e1e4e9",
  dark: "#15171b",
  dark2: "#2b2e34",
  onDark: "#f4f5f7",
  onDarkSoft: "#b5b9c0",
  lime: "#d6ef3e",
  limeInk: "#5f7a10",
  amber: "#f0b54a",
  pos: "#2f8a55",
  neg: "#c4553a",
};
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'SF Mono', Menlo, Consolas, 'Courier New', monospace";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const cents = (x: number) => `${Math.max(1, Math.min(99, Math.round(x * 100)))}¢`;
const verb = (a: string) => (a === "wager" ? "Back" : "Lean");
const tag = (a: string) => (a === "wager" ? "WAGER" : a === "hold" ? "LEAN" : "SKIP");

export function DailyEmail({ issue, siteUrl, address }: { issue: DailyIssue; siteUrl: string; address?: string }) {
  const { pick } = issue;
  return (
    <Html lang="en">
      <Head />
      <Preview>{issue.subject}</Preview>
      <Body style={{ background: C.canvas, margin: 0, padding: "24px 0", fontFamily: SANS, color: C.ink }}>
        <Container style={{ width: "100%", maxWidth: 600, margin: "0 auto", padding: "0 16px" }}>
          {/* Masthead */}
          <Section style={{ padding: "4px 4px 18px" }}>
            <Row>
              <Column>
                <Text style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.soft }}>HedgePredict Daily</Text>
                <Text style={{ margin: "6px 0 0", fontSize: 30, lineHeight: "34px", fontWeight: 800, letterSpacing: "-0.02em" }}>{issue.title}</Text>
                <Text style={{ margin: "6px 0 0", fontFamily: MONO, fontSize: 12, color: C.faint }}>2-minute read · prices as of 8:00 AM ET</Text>
              </Column>
            </Row>
            {issue.intro && <Text style={{ margin: "14px 0 0", fontSize: 15, lineHeight: "23px", color: C.soft }}>{issue.intro}</Text>}
          </Section>

          {/* 01 Today's pick */}
          <Label n="01" text="Today's pick" />
          {pick?.call ? (
            <Section style={{ background: C.dark, borderRadius: 18, padding: "20px 22px", color: C.onDark }}>
              <Text style={{ margin: 0 }}>
                <span style={{ color: pick.call.action === "wager" ? C.lime : C.amber, fontSize: 12 }}>●</span>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: C.onDarkSoft, marginLeft: 6 }}>
                  {pick.call.action === "wager" ? "Wager" : "Lean"}
                </span>
              </Text>
              <Text style={{ margin: "12px 0 0", fontSize: 25, lineHeight: "30px", fontWeight: 800, letterSpacing: "-0.02em", color: C.onDark }}>
                {verb(pick.call.action)} <span style={{ color: C.lime }}>{pick.call.side}</span> at {cents(pick.call.sidePrice)}
              </Text>
              <Text style={{ margin: "6px 0 0", fontSize: 14, lineHeight: "20px", color: C.onDarkSoft }}>{pick.question}</Text>
              <Text style={{ margin: "10px 0 0", fontFamily: MONO, fontSize: 12, color: C.onDarkSoft }}>
                {pct(pick.call.strength)} sure it&apos;s too cheap
                {pick.call.confidence != null ? ` · ${pct(pick.call.confidence)} confidence` : ""} · resolves {pick.when}
              </Text>
              <Section style={{ marginTop: 16 }}>
                <Button href={pick.href} style={{ background: C.lime, color: C.dark, fontWeight: 700, fontSize: 14, borderRadius: 999, padding: "10px 18px" }}>
                  Open in HedgePredict
                </Button>
                <Link href={polymarketUs(pick.question)} style={{ marginLeft: 16, color: C.onDarkSoft, fontSize: 13, textDecoration: "underline" }}>
                  Trade on Polymarket ↗
                </Link>
              </Section>
            </Section>
          ) : null}
          {pick?.background && (
            <Section style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: 18, padding: "16px 20px", marginTop: 10 }}>
              <Text style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.faint }}>The background · from today&apos;s news</Text>
              <Text style={{ margin: "6px 0 0", fontSize: 15, lineHeight: "23px", color: C.ink }}>{pick.background.story}</Text>
              {pick.background.sources.length > 0 && (
                <Text style={{ margin: "8px 0 0", fontSize: 12.5, color: C.faint }}>
                  Sources:{" "}
                  {pick.background.sources.map((src, i) => (
                    <span key={src.url}>
                      {i > 0 && " · "}
                      <Link href={src.url} style={{ color: C.soft, textDecoration: "underline" }}>{src.title}</Link>
                    </span>
                  ))}
                </Text>
              )}
              <Text style={{ margin: "8px 0 0", fontSize: 11.5, color: C.faint }}>
                Background is news context. The call above comes only from the market&apos;s numbers.
              </Text>
            </Section>
          )}
          {!pick?.call && (
            <Section style={{ background: C.card, border: `1px dashed ${C.rule}`, borderRadius: 18, padding: "18px 20px" }}>
              <Text style={{ margin: 0, fontSize: 15, lineHeight: "22px" }}>
                <b>No standout play today.</b> The board looks fairly priced. That&apos;s a real answer: sitting out is a position.
              </Text>
            </Section>
          )}

          {/* 02 The board */}
          <Label n="02" text="The board" />
          <Card>
            <Text style={{ margin: "0 0 6px", fontSize: 14, color: C.soft }}>
              <b style={{ color: C.ink }}>
                {[issue.counts.wager && `${issue.counts.wager} to wager`, issue.counts.lean && `${issue.counts.lean} to lean on`]
                  .filter(Boolean)
                  .join(" · ") || "No calls"}
              </b>{" "}
              · {issue.counts.skip} look priced right
              {issue.counts.decided ? ` · ${issue.counts.decided} decided` : ""}
            </Text>
            {issue.leans.length === 0 && <Text style={{ margin: 0, fontSize: 14, color: C.faint }}>No other leans this morning.</Text>}
            {issue.leans.map((m) => (
              <MarketLine key={m.id} m={m} right={m.call ? `${pct(m.call.strength)} sure` : ""} note={m.background?.story}>
                {verb(m.call!.action)} <b>{m.call!.side}</b> at {cents(m.call!.sidePrice)}
              </MarketLine>
            ))}
          </Card>

          {/* 03 On the clock */}
          <Label n="03" text="On the clock · next 24h" />
          <Card>
            {issue.onTheClock.length === 0 && <Text style={{ margin: 0, fontSize: 14, color: C.faint }}>Nothing on the board resolves in the next 24 hours.</Text>}
            {issue.onTheClock.map((m) => (
              <MarketLine key={m.id} m={m} lead={m.when} right={m.call ? `${tag(m.call.action)} · ${m.call.side}` : "SKIP"} />
            ))}
          </Card>

          {/* 04 Movers */}
          <Label n="04" text="Movers · last 24h" />
          <Card>
            {issue.movers.length === 0 && <Text style={{ margin: 0, fontSize: 14, color: C.faint }}>A quiet day: nothing moved more than 2 points.</Text>}
            {issue.movers.map((m) => (
              <MarketLine
                key={m.id}
                m={m}
                lead={`${m.move24h! >= 0 ? "▲" : "▼"} ${Math.abs(m.move24h! * 100).toFixed(1)}`}
                leadColor={m.move24h! >= 0 ? C.pos : C.neg}
                right={`${m.outcome.length <= 8 ? m.outcome : ""} ${pct(m.price)}`.trim()}
              />
            ))}
          </Card>

          {/* Tools */}
          <Section style={{ padding: "22px 4px 4px", textAlign: "center" }}>
            <Text style={{ margin: 0, fontSize: 13, color: C.soft }}>
              <Link href={`${siteUrl}/`} style={{ color: C.ink, fontWeight: 600 }}>Open the board</Link>
              {"  ·  "}
              <Link href={`${siteUrl}/ask`} style={{ color: C.ink, fontWeight: 600 }}>Ask HedgePredict</Link>
              {"  ·  "}
              <Link href={`${siteUrl}/hedge`} style={{ color: C.ink, fontWeight: 600 }}>Hedge Lab</Link>
            </Text>
          </Section>

          <Hr style={{ borderColor: C.rule, margin: "22px 0 14px" }} />
          <Text style={{ margin: 0, fontSize: 11.5, lineHeight: "17px", color: C.faint, textAlign: "center" }}>
            Our percentages show how sure we are that a side is too cheap, not chances of winning; prices are the crowd&apos;s odds.
            Calls come from prices, recent price moves, volume and timing, not news. Decision support, not financial advice; HedgePredict never
            places trades. Only risk what you can afford to lose. Prediction markets aren&apos;t available everywhere.
          </Text>
          <Text style={{ margin: "10px 0 0", fontSize: 11.5, lineHeight: "17px", color: C.faint, textAlign: "center" }}>
            You&apos;re getting this because you signed up at HedgePredict.{" "}
            <Link href="{{{RESEND_UNSUBSCRIBE_URL}}}" style={{ color: C.soft, textDecoration: "underline" }}>Unsubscribe</Link>
            {address ? <><br />{address}</> : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function Label({ n, text }: { n: string; text: string }) {
  return (
    <Text style={{ margin: "26px 4px 8px", fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: C.faint, fontWeight: 700 }}>
      <span style={{ color: C.ink }}>{n}</span> · {text.toUpperCase()}
    </Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <Section style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: 18, padding: "14px 18px" }}>{children}</Section>;
}

/** One market as a scannable line: optional lead (time or move) · question · right-aligned tag. */
function MarketLine({
  m,
  lead,
  leadColor,
  right,
  children,
  note,
}: {
  m: IssueMarket;
  lead?: string;
  leadColor?: string;
  right?: string;
  children?: React.ReactNode;
  /** One line of news background, shown under the market. */
  note?: string;
}) {
  return (
    <Row style={{ borderTop: `1px solid ${C.rule}` }}>
      {lead && (
        <Column style={{ width: 82, padding: "11px 8px 11px 0", verticalAlign: "top" }}>
          <Text style={{ margin: 0, fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: leadColor ?? C.ink }}>{lead}</Text>
        </Column>
      )}
      <Column style={{ padding: "11px 0", verticalAlign: "top" }}>
        {children && <Text style={{ margin: "0 0 2px", fontSize: 14, color: C.ink }}>{children}</Text>}
        <Link href={m.href} style={{ fontSize: children ? 13 : 14, lineHeight: "19px", color: children ? C.soft : C.ink, textDecoration: "none" }}>
          {m.question}
        </Link>
        {note && <Text style={{ margin: "6px 0 0", fontSize: 13, lineHeight: "19px", color: C.ink }}>{note}</Text>}
      </Column>
      {right && (
        <Column style={{ width: 110, padding: "11px 0 11px 8px", verticalAlign: "top", textAlign: "right" }}>
          <Text style={{ margin: 0, fontFamily: MONO, fontSize: 11.5, color: C.faint }}>{right}</Text>
        </Column>
      )}
    </Row>
  );
}
