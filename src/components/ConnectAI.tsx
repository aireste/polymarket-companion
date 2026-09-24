"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Use this in your own AI" — the second front door, made visible.
 *
 * The dashboard is one way to reach the engine; this section is the on-ramp to
 * the other. It hands a visitor the live MCP endpoint and the exact steps to
 * connect it to their own assistant, so HedgePredict does the ranking, reads,
 * and edge math from inside their AI. Dark "centerpiece" card, echoing the
 * featured-market and recommendation cards already in the system.
 */

const MCP_URL = "https://polymarket-companion-nu.vercel.app/api/mcp";

type ClientId = "claude" | "claudecode" | "chatgpt";

interface ClientTab {
  id: ClientId;
  label: string;
  /** A shell command to copy (Claude Code), instead of URL steps. */
  command?: string;
  steps: string[];
  note?: string;
}

const CLIENTS: ClientTab[] = [
  {
    id: "claude",
    label: "Claude",
    steps: [
      "Copy the server URL above.",
      "In Claude, open Settings, Connectors, Add custom connector, and paste the URL. Leave it on No sign-in when asked.",
      'Start a chat: "Use HedgePredict to show me the best coinflip markets today."',
    ],
    note: "Custom connectors need a paid Claude plan (Pro, Max, or Team).",
  },
  {
    id: "claudecode",
    label: "Claude Code",
    command: `claude mcp add --transport http hedgepredict ${MCP_URL}`,
    steps: [
      "Copy the command above and run it in your terminal.",
      'Ask Claude Code: "Use hedgepredict to get the best plays today."',
      "Approve the tool call, and it reads live markets right in your session.",
    ],
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    steps: [
      "Copy the server URL above.",
      "In ChatGPT settings, open Connectors, add a custom MCP connector, and paste the URL.",
      'Ask: "Use the HedgePredict connector for today’s best coinflip markets."',
    ],
    note: "Custom MCP connectors require a plan and setting that supports them; availability varies.",
  },
];

const PROMPTS = [
  "Show me the best coinflip markets today.",
  "Get an AI recommendation on the top market.",
  "I think it's 60% likely. Size a $200 play and hedge it.",
];

/** Copy text and briefly flag the given key as copied. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard blocked (rare, e.g. insecure context): leave state unchanged.
    }
  }, []);
  return { copied, copy };
}

export function ConnectAI() {
  const [active, setActive] = useState<ClientId>("claude");
  const { copied, copy } = useCopy();
  const tab = CLIENTS.find((c) => c.id === active)!;

  return (
    <section className="connect" aria-label="Use HedgePredict in your own AI">
      <div className="connect-intro">
        <p className="connect-eyebrow">The second door</p>
        <h2 className="connect-h">Bring HedgePredict into your own AI.</h2>
        <p className="connect-lede">
          This dashboard is one way in. The same engine also runs as a tool your
          assistant can call, so it does the ranking, the live reads, and the
          edge math from inside a normal conversation. Same URL works in any MCP
          client.
        </p>
      </div>

      <div className="connect-url">
        <span className="connect-url-k">MCP endpoint</span>
        <code className="connect-url-v">{MCP_URL}</code>
        <button
          className="connect-copy"
          onClick={() => copy("url", MCP_URL)}
          aria-label="Copy the MCP endpoint URL"
        >
          {copied === "url" ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div className="connect-tabs" role="tablist" aria-label="Choose your AI client">
        {CLIENTS.map((c) => (
          <button
            key={c.id}
            role="tab"
            id={`connect-tab-${c.id}`}
            aria-selected={active === c.id}
            aria-controls={`connect-panel-${c.id}`}
            tabIndex={active === c.id ? 0 : -1}
            className={`connect-tab${active === c.id ? " active" : ""}`}
            onClick={() => setActive(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div
        className="connect-panel"
        role="tabpanel"
        id={`connect-panel-${tab.id}`}
        aria-labelledby={`connect-tab-${tab.id}`}
      >
        {tab.command && (
          <div className="connect-cmd">
            <code>{tab.command}</code>
            <button
              className="connect-copy"
              onClick={() => copy("cmd", tab.command!)}
              aria-label="Copy the Claude Code command"
            >
              {copied === "cmd" ? "Copied ✓" : "Copy"}
            </button>
          </div>
        )}

        <ol className="connect-steps">
          {tab.steps.map((s, i) => (
            <li key={i}>
              <span className="connect-n" aria-hidden>
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        {tab.note && <p className="connect-note">{tab.note}</p>}
      </div>

      <div className="connect-prompts">
        <span className="connect-prompts-k">Try asking</span>
        <div className="connect-chips">
          {PROMPTS.map((p, i) => (
            <button
              key={i}
              className="connect-chip"
              onClick={() => copy(`p${i}`, p)}
              title="Copy this prompt"
            >
              <span>{p}</span>
              <span className="connect-chip-c">
                {copied === `p${i}` ? "Copied ✓" : "Copy"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="connect-foot">
        Open access, reads public market data, and never places trades. AI
        recommendations run on the host&apos;s own model credits.
      </p>
    </section>
  );
}
