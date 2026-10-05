/**
 * HedgePredict Daily, the email: a conversational read (opener, the play and the case for it, a
 * couple of plays per beat with a note each, what we're passing on, the week ahead), not a copy
 * of the board. React Email components render to
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
import { TIP_URL } from "@/lib/links";

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
      <Preview>{issue.opener ?? issue.subject}</Preview>
      <Body style={{ background: C.canvas, margin: 0, padding: "24px 0", fontFamily: SANS, fontWeight: 500, color: C.ink }}>
        <Container style={{ width: "100%", maxWidth: 600, margin: "0 auto", padding: "0 16px" }}>
          {/* Masthead and the opener: what today is about, in a couple of sentences. */}
          <Section style={{ padding: "4px 2px 6px" }}>
            <Text style={{ ...K, color: C.soft }}>
              <span style={{ color: C.ink }}>HedgePredict</span> Daily
            </Text>
            <Text style={{ margin: "8px 0 0", fontSize: 34, lineHeight: "36px", fontWeight: 900, letterSpacing: "-0.045em" }}>{issue.title}</Text>
            <Text style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, color: C.faint }}>2-minute read</Text>
            {issue.opener && <Text style={{ margin: "16px 0 0", fontSize: 17, lineHeight: "26px", color: C.ink }}>{issue.opener}</Text>}
          </Section>

          {/* The play: the one pick, then the case for it. */}
          <Label text="The play" />
          {pick?.call ? (
            <Section style={{ background: C.dark, borderRadius: R, padding: "22px 24px 24px", color: C.onDark }}>
              <Text style={{ ...K, color: C.onDarkSoft }}>{pick.question}</Text>
              <Text style={{ margin: "10px 0 0", fontSize: 30, lineHeight: "34px", fontWeight: 900, letterSpacing: "-0.04em", color: C.onDark }}>
                <span style={{ color: callColor(a, true) }}>{word(a!)}</span> {pick.call.side} at {cents(pick.call.sidePrice)}
              </Text>
              <Text style={{ margin: "10px 0 0", fontSize: 13, lineHeight: "19px", fontWeight: 700, color: C.onDarkSoft }}>
                {pct(pick.call.strength)} sure it&apos;s too cheap · {pick.game ? "starts" : "resolves"} {pick.when}
              </Text>
              {issue.pickWhy && <Text style={{ margin: "16px 0 0", fontSize: 16, lineHeight: "25px", color: C.onDark }}>{issue.pickWhy}</Text>}
              <Section style={{ marginTop: 18 }}>
                <Button href={pick.href} style={{ background: C.ice, color: C.dark, fontWeight: 700, fontSize: 14, borderRadius: 3, padding: "12px 18px" }}>
                  See the full read
                </Button>
                <Link href={pick.url} style={{ marginLeft: 18, color: C.onDark, fontSize: 14, fontWeight: 700, textDecoration: "underline" }}>
                  Trade on Polymarket ↗
                </Link>
              </Section>
            </Section>
          ) : (
            <Sheet>
              <Text style={{ margin: 0, fontSize: 22, lineHeight: "26px", fontWeight: 900, letterSpacing: "-0.03em", color: C.skip }}>No play today.</Text>
              <Text style={{ margin: "8px 0 0", fontSize: 16, lineHeight: "25px" }}>
                {issue.pickWhy ?? "The board looks fairly priced. That's a real answer: sitting out is a position."}
              </Text>
            </Sheet>
          )}
          {pick?.background && (
            <Sheet top={6}>
              <Text style={{ ...K, color: C.faint }}>What&apos;s going on</Text>
              <Text style={{ margin: "8px 0 0", fontSize: 15, lineHeight: "23px", color: C.ink }}>{pick.background.story}</Text>
              <Sources list={pick.background.sources} />
            </Sheet>
          )}

          {/* Around the markets: a couple of plays per beat, each with a note. */}
          {issue.beats.length > 0 && <Label text="Around the markets" />}
          {issue.beats.map((beat) => (
            <Sheet key={beat.id} top={6}>
              <Text style={{ ...K, color: C.faint }}>{beat.label}</Text>
              {beat.plays.map((m, i) => (
                <Play key={m.id} m={m} first={i === 0} />
              ))}
            </Sheet>
          ))}

          {/* Passing on: one popular market we think is priced fair. */}
          {issue.pass && (
            <>
              <Label text="What we're passing on" />
              <Sheet>
                <Play m={issue.pass} first />
              </Sheet>
            </>
          )}

          {/* The week ahead */}
          {issue.week.length > 0 && (
            <>
              <Label text="The week ahead" />
              <Sheet>
                {issue.weekIntro && <Text style={{ margin: "0 0 10px", fontSize: 15, lineHeight: "23px", color: C.ink }}>{issue.weekIntro}</Text>}
                {issue.week.map((w) => (
                  <Row key={w.id} style={{ borderTop: `1px solid ${C.rule}` }}>
                    <Column style={{ width: 96, padding: "11px 8px 11px 0", verticalAlign: "top" }}>
                      <Text style={{ margin: 0, fontSize: 14, fontWeight: 900, letterSpacing: "-0.01em", color: C.ink }}>{w.day}</Text>
                    </Column>
                    <Column style={{ padding: "11px 0", verticalAlign: "top" }}>
                      <Link href={w.href} style={{ fontSize: 14.5, lineHeight: "20px", fontWeight: 700, color: C.ink, textDecoration: "none" }}>{w.question}</Link>
                    </Column>
                    <Column style={{ width: 130, padding: "11px 0 11px 8px", verticalAlign: "top", textAlign: "right" }}>
                      <Text style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.faint }}>{w.price}</Text>
                    </Column>
                  </Row>
                ))}
              </Sheet>
            </>
          )}

          {/* Sign-off */}
          <Section style={{ padding: "26px 2px 4px" }}>
            {issue.scorecard && <Text style={{ margin: "0 0 10px", fontSize: 14, lineHeight: "21px", fontWeight: 700, color: C.soft }}>{issue.scorecard}</Text>}
            {issue.signoff && <Text style={{ margin: 0, fontSize: 16, lineHeight: "24px", color: C.ink }}>{issue.signoff}</Text>}
            <Text style={{ margin: "14px 0 0", fontSize: 14, fontWeight: 700, color: C.faint }}>
              <Link href={`${siteUrl}/`} style={{ color: C.ink, fontWeight: 700 }}>Open the board</Link>
              {"   ·   "}
              <Link href={`${siteUrl}/hedge`} style={{ color: C.ink, fontWeight: 700 }}>Test a bet in Hedge Lab</Link>
              {"   ·   "}
              <Link href={`${siteUrl}/ask`} style={{ color: C.ink, fontWeight: 700 }}>Ask HedgePredict</Link>
            </Text>
            <Text style={{ margin: "14px 0 0", fontSize: 13.5, lineHeight: "20px", color: C.soft }}>
              HedgePredict is free. If it&apos;s been useful, you can{" "}
              <Link href={TIP_URL} style={{ color: C.ink, fontWeight: 700, textDecoration: "underline" }}>buy me a coffee</Link>.
            </Text>
          </Section>

          <Hr style={{ borderColor: C.rule, margin: "22px 0 14px" }} />
          <Text style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: C.faint, textAlign: "center" }}>
            Our percentages show how sure we are that a side is too cheap, not chances of winning; prices are the crowd&apos;s odds.
            Calls come from prices, recent price moves and timing, not news; the news is there for context. Prices are as of when this was
            written and will have moved. Decision support, not financial advice; HedgePredict never places trades. Only risk what you can
            afford to lose. Prediction markets aren&apos;t available everywhere.
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

/** Section title: a chunky heading, like the site's section heads. */
function Label({ text }: { text: string }) {
  return <Text style={{ margin: "30px 2px 10px", fontSize: 20, lineHeight: "24px", fontWeight: 900, letterSpacing: "-0.03em", color: C.ink }}>{text}</Text>;
}

/** One white sheet with hairline rows: no rounded cards. */
function Sheet({ children, top = 0 }: { children: React.ReactNode; top?: number }) {
  return (
    <Section style={{ background: C.card, border: `1px solid ${C.rule}`, borderRadius: R, padding: "16px 20px", marginTop: top }}>{children}</Section>
  );
}

function Sources({ list }: { list: { title: string; url: string }[] }) {
  if (!list.length) return null;
  return (
    <Text style={{ margin: "8px 0 0", fontSize: 12.5, fontWeight: 700, color: C.faint }}>
      {list.length > 1 ? "Sources" : "Source"}:{" "}
      {list.map((src, i) => (
        <span key={src.url}>
          {i > 0 && " · "}
          <Link href={src.url} style={{ color: C.soft, textDecoration: "underline" }}>{src.title}</Link>
        </span>
      ))}
    </Text>
  );
}

/** One play as a short read: the call in bold, the market, then the note. */
function Play({ m, first }: { m: IssueMarket; first: boolean }) {
  return (
    <Section style={{ borderTop: first ? undefined : `1px solid ${C.rule}`, padding: first ? "10px 0 2px" : "14px 0 2px", marginTop: first ? 0 : 12 }}>
      <Text style={{ margin: 0, fontSize: 17, lineHeight: "22px", fontWeight: 900, letterSpacing: "-0.02em", color: C.ink }}>
        {m.call ? (
          <>
            <span style={{ color: callColor(m.call.action) }}>{word(m.call.action)}</span> {m.call.side} at {cents(m.call.sidePrice)}
          </>
        ) : (
          <span style={{ color: C.skip }}>Priced fair</span>
        )}
      </Text>
      <Text style={{ margin: "3px 0 0", fontSize: 13.5, lineHeight: "20px", fontWeight: 700, color: C.soft }}>
        <Link href={m.href} style={{ color: C.soft, textDecoration: "none" }}>{m.question}</Link>
        {" · "}
        {m.game ? "starts" : "resolves"} {m.when}
      </Text>
      {m.note && <Text style={{ margin: "8px 0 0", fontSize: 15.5, lineHeight: "24px", color: C.ink }}>{m.note}</Text>}
      {m.background && <Sources list={m.background.sources} />}
    </Section>
  );
}
