/**
 * HedgePredict Daily, the email. React Email components render to
 * table-based HTML with inline styles that survive Gmail, Apple Mail and
 * Outlook. Brand colors are the site's OKLCH tokens converted to hex (email
 * clients don't support oklch). Restyled 2026-10-01 to match the site: chunky
 * Satoshi Black titles, sharp corners, hairlines, and the green/amber/gray calls.
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
  canvas: "#eceef1",
  card: "#ffffff",
  ink: "#16181c",
  soft: "#565a62",
  faint: "#878b93",
  rule: "#e3e5e9",
  dark: "#0b0b0c",
  dark2: "#26282c",
  onDark: "#f4f4f1",
  onDarkSoft: "#a9adb4",
  ice: "#c9e2f2",
  // call colors, same meaning as the site: green = Wager, amber = Lean, gray = Skip
  wager: "#2e8f55",
  wagerOnDark: "#5fd38a",
  lean: "#a46d10",
  leanOnDark: "#f0b54a",
  skip: "#878b93",
  pos: "#2e8f55",
  neg: "#c4553a",
};
// Satoshi where the client loads web fonts (Apple Mail, iOS); a heavy system font elsewhere (Gmail, Outlook).
const SANS = "Satoshi, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const R = 4; // corner radius: sharp, like the site

const pct = (x: number) => `${Math.round(x * 100)}%`;
const cents = (x: number) => `${Math.max(1, Math.min(99, Math.round(x * 100)))}¢`;
const verb = (a: string) => (a === "wager" ? "Back" : "Lean");
const word = (a: string) => (a === "wager" ? "Wager" : a === "hold" ? "Lean" : "Skip");
const callColor = (a?: string, onDark = false) =>
  a === "wager" ? (onDark ? C.wagerOnDark : C.wager) : a === "hold" ? (onDark ? C.leanOnDark : C.lean) : C.skip;
const K = { margin: 0, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const };

export function DailyEmail({ issue, siteUrl, address }: { issue: DailyIssue; siteUrl: string; address?: string }) {
  const { pick } = issue;
  const a = pick?.call?.action;
  return (
    <Html lang="en">
      <Head>
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap" rel="stylesheet" />
      </Head>
      <Preview>{issue.subject}</Preview>
      <Body style={{ background: C.canvas, margin: 0, padding: "24px 0", fontFamily: SANS, fontWeight: 500, color: C.ink }}>
        <Container style={{ width: "100%", maxWidth: 600, margin: "0 auto", padding: "0 16px" }}>
          {/* Masthead */}
          <Section style={{ padding: "4px 2px 20px" }}>
            <Text style={{ ...K, color: C.soft }}>
              <span style={{ color: C.ink }}>HedgePredict</span> Daily
            </Text>
            <Text style={{ margin: "8px 0 0", fontSize: 34, lineHeight: "36px", fontWeight: 900, letterSpacing: "-0.045em" }}>{issue.title}</Text>
            <Text style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, color: C.faint }}>2-minute read · prices as of 8:00 AM ET</Text>
            {issue.intro && <Text style={{ margin: "14px 0 0", fontSize: 16, lineHeight: "24px", color: C.soft }}>{issue.intro}</Text>}
          </Section>

          {/* 01 Today's pick: the call and the price as two big numbers */}
          <Label n="01" text="Today's pick" />
          {pick?.call ? (
            <Section style={{ background: C.dark, borderRadius: R, padding: "22px 24px 24px", color: C.onDark }}>
              <Row>
                <Column style={{ width: "50%", verticalAlign: "top" }}>
                  <Text style={{ ...K, color: C.onDarkSoft }}>The call</Text>
                  <Text style={{ margin: "6px 0 0", fontSize: 48, lineHeight: "48px", fontWeight: 900, letterSpacing: "-0.05em", color: callColor(a, true) }}>{word(a!)}</Text>
                </Column>
                <Column style={{ width: "50%", verticalAlign: "top" }}>
                  <Text style={{ ...K, color: C.onDarkSoft }}>Price</Text>
                  <Text style={{ margin: "6px 0 0", fontSize: 48, lineHeight: "48px", fontWeight: 900, letterSpacing: "-0.05em", color: C.onDark }}>{cents(pick.call.sidePrice)}</Text>
                </Column>
              </Row>
              <Text style={{ margin: "18px 0 0", fontSize: 24, lineHeight: "28px", fontWeight: 900, letterSpacing: "-0.035em", color: C.onDark }}>
                {verb(a!)} <span style={{ color: callColor(a, true) }}>{pick.call.side}</span> at {cents(pick.call.sidePrice)}
              </Text>
              <Text style={{ margin: "6px 0 0", fontSize: 15, lineHeight: "21px", fontWeight: 700, color: C.onDarkSoft }}>{pick.question}</Text>
              <Text style={{ margin: "12px 0 0", fontSize: 13, lineHeight: "19px", fontWeight: 700, color: C.onDarkSoft }}>
                {pct(pick.call.strength)} sure it&apos;s too cheap
                {" "}· resolves {pick.when}
              </Text>
              <Section style={{ marginTop: 18 }}>
                <Button href={pick.href} style={{ background: C.ice, color: C.dark, fontWeight: 700, fontSize: 14, borderRadius: 3, padding: "12px 18px" }}>
                  Open in HedgePredict
                </Button>
                <Link href={polymarketUs(pick.question)} style={{ marginLeft: 18, color: C.onDark, fontSize: 14, fontWeight: 700, textDecoration: "underline" }}>
                  Trade on Polymarket ↗
                </Link>
              </Section>
            </Section>
          ) : null}
          {pick?.background && (
            <Sheet top={6}>
              <Text style={{ ...K, color: C.faint }}>The background · from today&apos;s news</Text>
              <Text style={{ margin: "8px 0 0", fontSize: 15, lineHeight: "23px", color: C.ink }}>{pick.background.story}</Text>
              {pick.background.sources.length > 0 && (
                <Text style={{ margin: "8px 0 0", fontSize: 12.5, fontWeight: 700, color: C.faint }}>
                  Sources:{" "}
                  {pick.background.sources.map((src, i) => (
                    <span key={src.url}>
                      {i > 0 && " · "}
                      <Link href={src.url} style={{ color: C.soft, textDecoration: "underline" }}>{src.title}</Link>
                    </span>
                  ))}
                </Text>
              )}
              <Text style={{ margin: "8px 0 0", fontSize: 12, color: C.faint }}>
                Background is news context. The call above comes only from the market&apos;s numbers.
              </Text>
            </Sheet>
          )}
          {!pick?.call && (
            <Sheet>
              <Text style={{ margin: 0, fontSize: 20, lineHeight: "24px", fontWeight: 900, letterSpacing: "-0.03em", color: C.skip }}>Skip today.</Text>
              <Text style={{ margin: "6px 0 0", fontSize: 15, lineHeight: "22px" }}>
                The board looks fairly priced. That&apos;s a real answer: sitting out is a position.
              </Text>
            </Sheet>
          )}

          {/* 02 The board */}
          <Label n="02" text="The board" />
          <Sheet>
            <Text style={{ margin: "0 0 8px", fontSize: 15, color: C.soft }}>
              <b style={{ color: C.ink, fontWeight: 900 }}>
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
                <span style={{ color: callColor(m.call!.action), fontWeight: 900 }}>{verb(m.call!.action)}</span> <b>{m.call!.side}</b> at {cents(m.call!.sidePrice)}
              </MarketLine>
            ))}
          </Sheet>

          {/* 03 On the clock */}
          <Label n="03" text="On the clock · next 24h" />
          <Sheet>
            {issue.onTheClock.length === 0 && <Text style={{ margin: 0, fontSize: 14, color: C.faint }}>Nothing on the board resolves in the next 24 hours.</Text>}
            {issue.onTheClock.map((m) => (
              <MarketLine
                key={m.id}
                m={m}
                lead={m.when}
                right={m.call ? `${word(m.call.action)} · ${m.call.side}` : "Skip"}
                rightColor={callColor(m.call?.action)}
              />
            ))}
          </Sheet>

          {/* 04 Movers */}
          <Label n="04" text="Movers · last 24h" />
          <Sheet>
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
          </Sheet>

          {/* Tools */}
          <Section style={{ padding: "24px 2px 4px", textAlign: "center" }}>
            <Text style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.faint }}>
              <Link href={`${siteUrl}/`} style={{ color: C.ink, fontWeight: 700 }}>Open the board</Link>
              {"   ·   "}
              <Link href={`${siteUrl}/ask`} style={{ color: C.ink, fontWeight: 700 }}>Ask HedgePredict</Link>
              {"   ·   "}
              <Link href={`${siteUrl}/hedge`} style={{ color: C.ink, fontWeight: 700 }}>Hedge Lab</Link>
            </Text>
          </Section>

          <Hr style={{ borderColor: C.rule, margin: "22px 0 14px" }} />
          <Text style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: C.faint, textAlign: "center" }}>
            Our percentages show how sure we are that a side is too cheap, not chances of winning; prices are the crowd&apos;s odds.
            Calls come from prices, recent price moves, volume and timing, not news. Decision support, not financial advice; HedgePredict never
            places trades. Only risk what you can afford to lose. Prediction markets aren&apos;t available everywhere.
          </Text>
          <Text style={{ margin: "10px 0 0", fontSize: 12, lineHeight: "18px", color: C.faint, textAlign: "center" }}>
            You&apos;re getting this because you signed up at HedgePredict.{" "}
            <Link href="{{{RESEND_UNSUBSCRIBE_URL}}}" style={{ color: C.soft, textDecoration: "underline" }}>Unsubscribe</Link>
            {address ? <><br />{address}</> : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** Section title: a number and a chunky heading, like the site's section heads. */
function Label({ n, text }: { n: string; text: string }) {
  return (
    <Text style={{ margin: "30px 2px 10px", fontSize: 20, lineHeight: "24px", fontWeight: 900, letterSpacing: "-0.03em", color: C.ink }}>
      <span style={{ color: C.faint, fontWeight: 700, fontSize: 14, letterSpacing: "0", marginRight: 8 }}>{n}</span>
      {text}
    </Text>
  );
}

/** One white sheet with hairline rows: no rounded cards. */
function Sheet({ children, top = 0 }: { children: React.ReactNode; top?: number }) {
  return (
    <Section style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: R, padding: "14px 20px", marginTop: top }}>{children}</Section>
  );
}

/** One market as a scannable line: optional lead (time or move) · question · right-aligned tag. */
function MarketLine({
  m,
  lead,
  leadColor,
  right,
  rightColor,
  children,
  note,
}: {
  m: IssueMarket;
  lead?: string;
  leadColor?: string;
  right?: string;
  rightColor?: string;
  children?: React.ReactNode;
  /** One line of news background, shown under the market. */
  note?: string;
}) {
  return (
    <Row style={{ borderTop: `1px solid ${C.rule}` }}>
      {lead && (
        <Column style={{ width: 84, padding: "12px 8px 12px 0", verticalAlign: "top" }}>
          <Text style={{ margin: 0, fontSize: 14, fontWeight: 900, letterSpacing: "-0.01em", color: leadColor ?? C.ink }}>{lead}</Text>
        </Column>
      )}
      <Column style={{ padding: "12px 0", verticalAlign: "top" }}>
        {children && <Text style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: C.ink }}>{children}</Text>}
        <Link href={m.href} style={{ fontSize: children ? 13.5 : 14.5, lineHeight: "20px", fontWeight: children ? 500 : 700, color: children ? C.soft : C.ink, textDecoration: "none" }}>
          {m.question}
        </Link>
        {note && <Text style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: "20px", color: C.ink }}>{note}</Text>}
      </Column>
      {right && (
        <Column style={{ width: 120, padding: "12px 0 12px 8px", verticalAlign: "top", textAlign: "right" }}>
          <Text style={{ margin: 0, fontSize: 13, fontWeight: 700, color: rightColor ?? C.faint }}>{right}</Text>
        </Column>
      )}
    </Row>
  );
}
