"use client";

import { useEffect, useState } from "react";

type Device = "phone" | "laptop";

/**
 * Today's email, exactly as rendered for subscribers, shown inside a phone or
 * a laptop mail window so visitors see what lands in their inbox. The email
 * HTML runs in a sandboxed iframe (no scripts); links open in a new tab.
 */
export function EmailPreview({ html, subject, from }: { html: string; subject: string; from: string }) {
  const [device, setDevice] = useState<Device>("phone");
  // The toggle is hidden on small screens; make sure a phone never sits on "laptop".
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 899.98px)");
    const sync = () => mq.matches && setDevice("phone");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const doc = html.replace("<head>", '<head><base target="_blank">');

  return (
    <div className="hp-ep">
      <div className="hp-ep-toggle" role="tablist" aria-label="Preview on">
        {(["phone", "laptop"] as const).map((d) => (
          <button key={d} role="tab" aria-selected={device === d} onClick={() => setDevice(d)}>
            {d === "phone" ? "Phone" : "Laptop"}
          </button>
        ))}
      </div>

      {device === "phone" ? (
        <div className="hp-ep-phone" key="phone">
          <div className="hp-ep-phone-screen">
            <div className="hp-ep-status" aria-hidden>
              <span>8:00</span>
              <span className="hp-ep-island" />
              <span>●●● ▮</span>
            </div>
            <div className="hp-ep-mailhead">
              <span className="hp-ep-avatar" aria-hidden>✦</span>
              <div>
                <b>{from}</b>
                <span>{subject}</span>
              </div>
              <time>8:00 AM</time>
            </div>
            <iframe title="Today's HedgePredict Daily on a phone" srcDoc={doc} sandbox="allow-popups allow-popups-to-escape-sandbox" />
          </div>
        </div>
      ) : (
        <div className="hp-ep-laptop" key="laptop">
          <div className="hp-ep-window">
            <div className="hp-ep-chrome" aria-hidden>
              <i />
              <i />
              <i />
              <span>Inbox</span>
            </div>
            <div className="hp-ep-mailhead is-wide">
              <span className="hp-ep-avatar" aria-hidden>✦</span>
              <div>
                <b>{from}</b>
                <span>{subject}</span>
              </div>
              <time>Today, 8:00 AM</time>
            </div>
            <iframe title="Today's HedgePredict Daily on a laptop" srcDoc={doc} sandbox="allow-popups allow-popups-to-escape-sandbox" />
          </div>
          <div className="hp-ep-base" aria-hidden />
        </div>
      )}
    </div>
  );
}
