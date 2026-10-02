/**
 * Today's email, exactly as rendered for subscribers, in a simple desktop mail
 * window. The email HTML runs in a sandboxed iframe (no scripts); links open in
 * a new tab. On phones the window chrome drops away and it reads as a plain card.
 */
export function EmailPreview({ html, subject, from }: { html: string; subject: string; from: string }) {
  const doc = html.replace("<head>", '<head><base target="_blank">');
  return (
    <div className="hp-ep">
      <div className="hp-ep-window">
        <div className="hp-ep-chrome" aria-hidden>
          <i />
          <i />
          <i />
          <span>Inbox</span>
        </div>
        <MailHead from={from} subject={subject} />
        <iframe title="Today's HedgePredict Daily" srcDoc={doc} sandbox="allow-popups allow-popups-to-escape-sandbox" />
      </div>
    </div>
  );
}

function MailHead({ from, subject }: { from: string; subject: string }) {
  return (
    <div className="hp-ep-mailhead is-wide">
      <span className="hp-ep-avatar" aria-hidden>✦</span>
      <div>
        <b>{from}</b>
        <span>{subject}</span>
      </div>
      <time>Today, 8:00 AM</time>
    </div>
  );
}

/** Same window while today's issue is still being put together. */
export function EmailPreviewSkeleton() {
  return (
    <div className="hp-ep" aria-busy="true" aria-label="Loading today's issue">
      <div className="hp-ep-window">
        <div className="hp-ep-chrome" aria-hidden>
          <i />
          <i />
          <i />
          <span>Inbox</span>
        </div>
        <MailHead from="HedgePredict Daily" subject="Today's issue is on its way…" />
        <div className="hp-ep-skl" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
