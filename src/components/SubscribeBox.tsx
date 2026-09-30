"use client";

import { useEffect, useId, useState } from "react";

const JOINED_KEY = "hp_daily_joined";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Phase = "idle" | "sending" | "done" | "error";

/** "jane.doe@gmail.com" -> "ja•••@gmail.com", for the "you're on the list" state. */
function mask(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(4, user.length - 2)))}@${domain}`;
}

/**
 * Signup for HedgePredict Daily. Posts to /api/subscribe, which files it in
 * the Formspree waitlist before launch and in Resend after, so this UI never
 * changes. Remembers a successful signup in this browser.
 */
export function SubscribeBox({ compact = false, source = "site" }: { compact?: boolean; source?: string }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [joined, setJoined] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    try {
      setJoined(localStorage.getItem(JOINED_KEY));
    } catch {
      /* private mode */
    }
  }, []);

  const valid = EMAIL_RE.test(email.trim());
  const showHint = touched && email.length > 0 && !valid;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || phase === "sending") return;
    setPhase("sending");
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source, company: trap }),
      });
      const d = (await res.json()) as { ok?: boolean; live?: boolean; error?: string };
      if (!d.ok) throw new Error(d.error ?? "Couldn't sign you up just now. Try again.");
      const clean = email.trim().toLowerCase();
      try {
        localStorage.setItem(JOINED_KEY, clean);
      } catch {
        /* fine */
      }
      setLive(Boolean(d.live));
      setJoined(clean);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setPhase("error");
    }
  };

  // Already on the list (this visit or an earlier one): a quiet confirmation, no re-ask.
  if (joined) {
    return (
      <section className={`hp-sub is-joined${compact ? " is-compact" : ""}`} aria-live="polite">
        <span className={`hp-sub-check${phase === "done" ? " is-new" : ""}`} aria-hidden>
          <svg viewBox="0 0 24 24">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <div className="hp-sub-copy">
          <b>You&apos;re on the list.</b>
          <p>
            {phase === "done" && !live
              ? `We'll send the first issue to ${mask(joined)} when The Daily launches. Weekdays at 8 AM ET after that.`
              : `Today's pick lands in ${mask(joined)} weekdays at 8 AM ET.`}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={`hp-sub${compact ? " is-compact" : ""}`} aria-labelledby={`${id}-t`}>
      <div className="hp-sub-copy">
        <b id={`${id}-t`}>Today&apos;s pick in your inbox.</b>
        <p>Jev&apos;s call, what resolves next, and the biggest movers. Weekdays at 8 AM ET, a 2-minute read.</p>
      </div>
      <form className="hp-sub-form" onSubmit={submit} noValidate>
        <div className={`hp-sub-field${showHint || phase === "error" ? " is-bad" : ""}`}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (phase === "error") setPhase("idle");
            }}
            onBlur={() => setTouched(true)}
            aria-label="Email address"
            aria-invalid={showHint}
            aria-describedby={`${id}-msg`}
            disabled={phase === "sending"}
          />
          <button type="submit" disabled={phase === "sending"} className={phase === "sending" ? "is-busy" : undefined}>
            {phase === "sending" ? <span className="hp-sub-spin" aria-label="Joining" /> : "Join"}
          </button>
        </div>
        {/* Honeypot: hidden from people, irresistible to bots. */}
        <input
          className="hp-sub-trap"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          name="company"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
        <p id={`${id}-msg`} className={`hp-sub-msg${showHint || phase === "error" ? " err" : ""}`} aria-live="polite">
          {showHint ? "Check that email address." : phase === "error" ? error : "No spam. Unsubscribe in one click."}
        </p>
      </form>
    </section>
  );
}
