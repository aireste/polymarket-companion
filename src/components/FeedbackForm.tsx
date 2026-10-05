"use client";

import { useState } from "react";
import Link from "next/link";
import { track } from "@/lib/track";

/** What's on your mind? A note to the people who run HedgePredict, with an optional email for a reply. */
export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email, page: document.referrer ? new URL(document.referrer).pathname : "", company: trap }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!d.ok) throw new Error(d.error ?? "Couldn't send that just now. Try again in a minute.");
      track("feedback_sent");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that just now. Try again in a minute.");
      setState("idle");
    }
  };

  if (state === "sent") {
    return (
      <div className="fb-done" role="status">
        <b>Got it. Thank you.</b>
        <p>{email ? "We read every note, and we'll reply to the email you left." : "We read every note."}</p>
        <Link href="/" className="fb-back">Back to the board</Link>
      </div>
    );
  }

  return (
    <form className="fb-form" onSubmit={send}>
      <label className="fb-field">
        <span>What&apos;s on your mind?</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={4000}
          required
          placeholder="Something confusing, broken or missing. A call you disagreed with. Anything."
        />
      </label>
      <label className="fb-field">
        <span>
          Your email <small>optional, only if you&apos;d like a reply</small>
        </span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
      </label>
      {/* Honeypot: hidden from people, irresistible to bots. */}
      <input className="fb-trap" type="text" name="company" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} aria-hidden />
      {error && <p className="fb-error" role="alert">{error}</p>}
      <button className="fb-send" type="submit" disabled={state === "sending" || message.trim().length < 3}>
        {state === "sending" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
