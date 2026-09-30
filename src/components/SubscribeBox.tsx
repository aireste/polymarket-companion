"use client";

import { useState } from "react";

type State = { kind: "idle" | "sending" } | { kind: "done" | "pending" | "error"; msg: string };

/** Email signup for HedgePredict Daily. Before email is configured it says "launching soon". */
export function SubscribeBox({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = (await res.json()) as { ok?: boolean; pending?: boolean; message?: string; error?: string };
      if (d.ok) setState({ kind: "done", msg: "You're in. First issue lands on the next weekday at 8 AM ET." });
      else if (d.pending) setState({ kind: "pending", msg: d.message ?? "Launching soon." });
      else setState({ kind: "error", msg: d.error ?? "Something went wrong. Try again." });
    } catch {
      setState({ kind: "error", msg: "Couldn't reach the server. Try again." });
    }
  };

  return (
    <section className={`hp-sub${compact ? " is-compact" : ""}`} aria-label="Subscribe to HedgePredict Daily">
      <div className="hp-sub-copy">
        <span className="hp-sub-k">HedgePredict Daily</span>
        <b>Today&apos;s pick in your inbox.</b>
        <p>Jev&apos;s call, what resolves next, and the biggest movers. Weekdays at 8 AM ET, a 2-minute read.</p>
      </div>
      {state.kind === "done" ? (
        <p className="hp-sub-msg ok">{state.msg}</p>
      ) : (
        <form className="hp-sub-form" onSubmit={submit}>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
          />
          <button type="submit" disabled={state.kind === "sending"}>
            {state.kind === "sending" ? "Joining…" : "Subscribe"}
          </button>
          {(state.kind === "pending" || state.kind === "error") && (
            <p className={`hp-sub-msg ${state.kind === "error" ? "err" : ""}`}>{state.msg}</p>
          )}
        </form>
      )}
    </section>
  );
}
