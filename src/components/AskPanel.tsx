"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Ask HedgePredict" — an on-site agentic chat over the same engine.
 *
 * A visitor types anything and Claude decides which tools to call (rank markets,
 * check news, size a play, pull history) via /api/chat. This is the on-page
 * mirror of the MCP experience for people without a paid AI plan.
 */

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const EXAMPLES = [
  "What are the best coinflip markets today?",
  "Any under-the-radar picks worth a look?",
  "I think it's 60% likely. Size a $200 play and hedge it.",
];

/** Minimal, safe formatting: **bold** spans, preserved line breaks. */
function renderContent(text: string) {
  return text.split("\n").map((line, i) => (
    <span key={i}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
        seg.startsWith("**") && seg.endsWith("**") ? (
          <strong key={j}>{seg.slice(2, -2)}</strong>
        ) : (
          <span key={j}>{seg}</span>
        )
      )}
      {i < text.split("\n").length - 1 && <br />}
    </span>
  ));
}

export function AskPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setError(null);
      const next: Msg[] = [...messages, { role: "user", content: trimmed }];
      setMessages(next);
      setInput("");
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
        });
        const data = (await res.json()) as { reply?: string; error?: string };
        if (data.reply) {
          setMessages((m) => [...m, { role: "assistant", content: data.reply! }]);
        } else {
          setError(data.error ?? "Something went wrong. Try again.");
        }
      } catch {
        setError("Couldn't reach the assistant. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [messages, loading]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const empty = messages.length === 0;

  return (
    <section className="ask-panel" id="ask-panel" aria-label="Ask HedgePredict">
      <div className="ask-head">
        <div>
          <h2>Ask HedgePredict</h2>
          <p className="ask-sub">
            Ask anything about today&apos;s markets in plain English. Jev makes the calibrated calls; Claude reads live data, checks the news, and does the edge math for you.
          </p>
        </div>
      </div>

      <div className="ask-log" ref={scrollRef} aria-live="polite">
        {empty && (
          <div className="ask-empty">
            <p>Try one of these:</p>
            <div className="ask-examples">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="ask-ex" onClick={() => send(ex)} disabled={loading}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`ask-msg ${m.role}`}>
            <span className="ask-who">{m.role === "user" ? "You" : "HedgePredict"}</span>
            <div className="ask-bubble">{renderContent(m.content)}</div>
          </div>
        ))}

        {loading && (
          <div className="ask-msg assistant">
            <span className="ask-who">HedgePredict</span>
            <div className="ask-bubble ask-thinking">
              <span className="rec-spinner" aria-hidden />
              Reading markets and thinking&hellip;
            </div>
          </div>
        )}

        {error && <p className="ask-error">{error}</p>}
      </div>

      <div className="ask-box">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about today's best plays, a market, or size your own bet…"
          rows={1}
          disabled={loading}
          aria-label="Your question"
        />
        <button
          className="ask-send"
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          aria-label="Send"
        >
          {loading ? (
            <span className="ask-send-spin" aria-hidden />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
      <p className="ask-foot">
        Decision support, not financial advice. Reads public data, never places trades.
      </p>
    </section>
  );
}
