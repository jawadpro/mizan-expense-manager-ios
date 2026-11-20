"use client";
import { useEffect, useState } from "react";
import CopyField from "@/components/CopyField";
import { FORWARDER, forwarderTemplate } from "@/lib/android-forwarder";

type Paired = { endpoint: string; authorization: string; token: string };

const SAMPLE = "PKR 1.00 debited from your account for a Mizan connection test.";

/**
 * Opened on the Android phone by scanning the QR code in Mizan. Gets this phone its own key with the one-time code
 * (from the #fragment, which the browser never sends to a server), then shows what to paste into the SMS forwarder
 * app, and a test that tells Mizan the phone is set up. Nothing is stored in the browser.
 */
export default function AndroidPairLauncher({ server }: { server: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [paired, setPaired] = useState<Paired | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const c = window.location.hash.replace(/^#/, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    setCode(c.length === 8 ? c : "");
  }, []);

  async function getKey() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${server}/api/devices/pair`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name: "Android phone" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.token) throw new Error(d.error || "That didn't work. Make a new QR code in Mizan and scan it again.");
      setPaired({ endpoint: d.endpoint, authorization: d.authorization, token: d.token });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!paired) return;
    setBusy(true);
    setTest(null);
    try {
      const r = await fetch(paired.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: paired.authorization },
        body: JSON.stringify({ sender: "TEST", text: SAMPLE, receivedAt: Date.now(), test: true }),
      });
      const d = await r.json().catch(() => ({}));
      setTest(r.ok ? { ok: true, text: d.message || "Mizan received the test." } : { ok: false, text: d.error || "Mizan didn't accept the test." });
    } catch {
      setTest({ ok: false, text: "Couldn't reach Mizan. Check this phone's internet and try again." });
    } finally {
      setBusy(false);
    }
  }

  if (code === null) return null;
  if (!code) {
    return <div className="alert error" role="alert">This link is incomplete. In Mizan, open Connect phone › Android and scan the new QR code.</div>;
  }
  return (
    <ol className="pair-flow">
      <li className={paired ? "done" : "now"}>
        <div className="pair-flow-head"><span className="iph-dot" aria-hidden>{paired ? "✓" : "1"}</span><b>Get this phone&apos;s key</b></div>
        {paired ? (
          <p className="small muted">This phone has its own key. Mizan lists it under Android phones, where you can remove it any time.</p>
        ) : (
          <>
            <button className="btn primary" onClick={getKey} disabled={busy}>{busy ? "Connecting…" : "Get my key"}</button>
            <p className="small muted">Uses the one-time code <b>{code.slice(0, 4)}-{code.slice(4)}</b>. It works for 10 minutes.</p>
            {error && <div className="alert error" role="alert">{error}</div>}
            <p className="small muted">Using the <b>Mizan Companion</b> app? Scan the QR code from inside the app instead; it does all of this by itself.</p>
          </>
        )}
      </li>
      <li className={paired ? "now" : ""}>
        <div className="pair-flow-head"><span className="iph-dot" aria-hidden>2</span><b>Set up {FORWARDER.name}</b></div>
        <p className="small muted">
          A free, open-source app that sends each SMS to a web address. Get it from <a href={FORWARDER.fdroid} target="_blank" rel="noreferrer">F-Droid</a> or
          its <a href={FORWARDER.github} target="_blank" rel="noreferrer">GitHub page</a> (Google Play doesn&apos;t allow SMS forwarders). Allow it to read SMS when it asks.
        </p>
        {paired && (
          <>
            <p className="small">
              Tap <b>+</b> to add a rule. For <b>Sender</b>, type <code>*</code> to forward every SMS (Mizan ignores anything that isn&apos;t a
              bank alert), or your bank&apos;s sender. Then copy these two:
            </p>
            <CopyField label="Webhook URL" value={paired.endpoint} />
            <CopyField label="JSON template" value={forwarderTemplate(paired.token)} multiline />
            <p className="small muted">Turn on <b>Store failed messages for retry</b>, so alerts that arrive with no internet are sent later. Then save the rule.</p>
            <details className="small">
              <summary>Using another app (MacroDroid, Tasker…)?</summary>
              <p className="muted">Send a POST with Content-Type <code>application/json</code> to the URL above, with the header below, and a body like <code>{`{"sender":"HBL","text":"…"}`}</code>. <code>receivedAt</code> is optional: ISO 8601 with a time zone, or Unix time.</p>
              <CopyField label="Authorization header" value={paired.authorization} />
            </details>
          </>
        )}
      </li>
      <li className={paired ? "now" : ""}>
        <div className="pair-flow-head"><span className="iph-dot" aria-hidden>{test?.ok ? "✓" : "3"}</span><b>Send a test</b></div>
        {paired ? (
          <>
            <button className={`btn ${test?.ok ? "" : "primary"}`} onClick={sendTest} disabled={busy}>Send a test</button>
            <p className="small muted">Mizan reads a sample alert and saves nothing. Mizan on your computer then shows this phone as connected.</p>
            {test && <div className={`alert ${test.ok ? "ok" : "error"}`} role="status">{test.text}</div>}
            {test?.ok && <p className="small muted">All set. Your next bank SMS will show up in Mizan within seconds. Keep this key private: anyone with it can send alerts to your Mizan.</p>}
          </>
        ) : (
          <p className="small muted">After step 1.</p>
        )}
      </li>
    </ol>
  );
}
