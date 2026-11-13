"use client";
import { useEffect, useState } from "react";
import { SHORTCUTS } from "@/components/ShortcutSteps";
import { useToast } from "@/components/Toast";

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Phone-sized steps to add the two Shortcuts and paste this account's URL and token into them. */
export default function ConnectPhone() {
  const toast = useToast();
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/sms`);
    const t = new URLSearchParams(window.location.hash.slice(1)).get("t");
    if (t && /^[A-Za-z0-9_-]{16,200}$/.test(t)) setToken(t);
    // Take the token out of the address bar so it isn't left in history or shared by accident.
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
  }, []);

  async function copyIt(text: string, what: string) {
    toast((await copy(text)) ? `${what} copied` : "Couldn't copy; press and hold to copy by hand", "ok");
  }

  return (
    <div className="setup-wrap connect-wrap">
      <div className="brand setup-brand"><span className="brand-mark" aria-hidden="true">م</span> Mizan</div>
      <div className="card setup-card">
        <h1>Connect your iPhone</h1>
        <p className="muted">Four steps, about two minutes. Keep this page open while you go back and forth to Shortcuts.</p>

        <ol className="connect-steps">
          <li>
            <strong>Add both Shortcuts</strong>
            <div className="connect-buttons">
              <a className="btn primary" href={SHORTCUTS.main.url}>Add “{SHORTCUTS.main.name}”</a>
              <a className="btn" href={SHORTCUTS.queue.url}>Add “{SHORTCUTS.queue.name}”</a>
            </div>
          </li>
          <li>
            <strong>Paste your URL and token</strong>
            <span className="small muted">When a Shortcut asks for them (or open it and tap the fields), paste these. Do it for both Shortcuts.</span>
            <div className="connect-copy">
              <code>{endpoint || "…"}</code>
              <button type="button" className="btn sm primary" onClick={() => copyIt(endpoint, "URL")} disabled={!endpoint}>Copy URL</button>
            </div>
            {token ? (
              <div className="connect-copy">
                <code>Bearer {"•".repeat(12)}</code>
                <button type="button" className="btn sm primary" onClick={() => copyIt(`Bearer ${token}`, "Token")}>Copy token</button>
              </div>
            ) : (
              <p className="small muted">No token came with the QR code. Copy it from SMS setup in Mizan on your computer (Copy for Shortcut).</p>
            )}
          </li>
          <li>
            <strong>Allow it to run on its own</strong>
            <span className="small muted">In Settings › Apps › Shortcuts › Advanced, turn on Allow Deleting Without Confirmation. Then run each Shortcut once and choose Always Allow when asked.</span>
          </li>
          <li>
            <strong>Make one automation per bank</strong>
            <span className="small muted">Shortcuts › Automation › + › Message. Set Sender to your bank as it shows in Messages, choose Run Immediately, then pick “{SHORTCUTS.main.name}”.</span>
          </li>
        </ol>
        <p className="small muted">Your next bank alert should appear in Mizan within a few seconds.</p>
      </div>
    </div>
  );
}
