"use client";
import { useEffect, useState } from "react";

/**
 * Opened on the iPhone by scanning the QR code in Mizan. The one-time code is in the #fragment, which the browser
 * never sends to any server; this page hands it to the installed Mizan Shortcut.
 */
export default function PairLauncher({ server, shortcutName, shortcutUrl }: { server: string; shortcutName: string; shortcutUrl: string | null }) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    const c = window.location.hash.replace(/^#/, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    setCode(c.length === 8 ? c : "");
  }, []);
  if (code === null) return null;
  if (!code) {
    return <div className="alert error" role="alert">This pairing link is incomplete. In Mizan, open Settings › Connected devices and tap Connect iPhone to get a new code.</div>;
  }
  const payload = `${server}/api/devices/pair?code=${code}`;
  const runUrl = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}&input=text&text=${encodeURIComponent(payload)}`;
  return (
    <div className="auth-actions">
      <div className="pair-code-big" aria-label="Pairing code">{code.slice(0, 4)}-{code.slice(4)}</div>
      <a className="btn primary" href={runUrl}>Connect this iPhone</a>
      <p className="small muted">This opens the <b>{shortcutName}</b> Shortcut and gives it the code. Allow it when iPhone asks. The code works once, for 10 minutes.</p>
      <div className="auth-divider">don&apos;t have the Shortcut yet?</div>
      {shortcutUrl
        ? <a className="btn" href={shortcutUrl}>Add the {shortcutName} Shortcut first</a>
        : <p className="small muted">Ask whoever runs this Mizan for the Shortcut link, add it, then come back and tap Connect this iPhone.</p>}
    </div>
  );
}
