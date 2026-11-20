"use client";
import { useEffect, useState } from "react";
import QrCode from "./QrCode";
import { FORWARDER } from "@/lib/android-forwarder";
import { ago, isAndroid, useDevices, useNewlyPaired, usePairingCode, type Device } from "./paired-devices";

/**
 * Pairing an Android phone. On a computer: one QR code. Scanned with the phone's camera it opens Mizan's Android
 * pairing page, which gets the phone its own key and shows what to paste into an SMS forwarder app; the Mizan
 * Companion app scans the same code itself. On the Android phone itself: a button to that same page.
 *
 * Like an iPhone, a new phone only counts once it has used its key (a test or its first alert). Calls onPaired then.
 */
export function PairAndroid({ onPaired, replaces }: { onPaired: (d: Device) => void; replaces?: string }) {
  const devices = useDevices(true, "android");
  const { paired, halfway } = useNewlyPaired(devices.data?.items, onPaired);
  const { code, error, secondsLeft, renew } = usePairingCode(!paired, { replaces, kind: "android" });
  const [phone, setPhone] = useState(false);
  useEffect(() => setPhone(isAndroid()), []);
  useEffect(() => {
    if (code && secondsLeft === 0 && !paired) renew();
  }, [code, secondsLeft, paired, renew]);

  if (paired) {
    return (
      <div className="iph-success" role="status">
        <span className="iph-check" aria-hidden>✓</span>
        <div><b>{paired.name}</b> is connected to Mizan.<div className="small muted">Paired {ago(paired.paired_at)}. Its key is stored only on that phone.</div></div>
      </div>
    );
  }
  if (error) return <div className="alert error" role="alert"><span>{error}</span><button className="btn sm" onClick={renew}>Try again</button></div>;
  if (!code) return <p className="small muted iph-loading">{phone ? "Getting ready…" : "Making a QR code…"}</p>;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const status = halfway ? (
    <div className="iph-waiting small" role="status"><span className="iph-pulse" aria-hidden /> Key received. Waiting for the phone&apos;s test or first bank alert… On the phone, tap <b>Send a test</b>.</div>
  ) : (
    <div className="iph-waiting small" role="status"><span className="iph-pulse" aria-hidden /> Waiting for your Android phone…</div>
  );
  const expiry = (
    <div className="small muted" aria-live="polite">
      {secondsLeft > 0 ? <>Works for {mm}:{ss}. </> : "Making a new one… "}
      <button type="button" className="linkish" onClick={renew}>{phone ? "New link" : "New QR code"}</button>
    </div>
  );
  if (phone) {
    return (
      <div className="iph-pair phone">
        <a className="btn primary" href={code.pairPageUrl}>Connect this phone</a>
        <p className="small muted">Opens the setup with your one-time code <b>{code.code}</b>: get this phone&apos;s key, paste it into {FORWARDER.name}, and send a test.</p>
        {expiry}
        {status}
      </div>
    );
  }
  return (
    <div className="iph-pair">
      <figure className="iph-qr">
        <QrCode value={code.pairPageUrl} size={200} label="QR code to connect your Android phone" />
      </figure>
      <div className="iph-pair-text">
        <ol className="iph-list">
          <li>Point your Android phone&apos;s <b>Camera</b> (or Google Lens) at the code and open the link.</li>
          <li>Tap <b>Get my key</b>, then copy the two values into the free <b>{FORWARDER.name}</b> app.</li>
          <li>Tap <b>Send a test</b>. Using the <b>Mizan Companion</b> app? Scan this code from the app instead.</li>
        </ol>
        {expiry}
        {status}
      </div>
    </div>
  );
}

/** What's left after pairing: the forwarder rule on the phone. Shown until the first bank alert arrives. */
export function ForwarderGuide() {
  return (
    <div className="iph-auto">
      <ol className="iph-steps">
        <li>On the phone, install <b>{FORWARDER.name}</b> from <a href={FORWARDER.fdroid} target="_blank" rel="noreferrer">F-Droid</a> or <a href={FORWARDER.github} target="_blank" rel="noreferrer">GitHub</a> and allow it to read SMS.</li>
        <li>Add a rule with the <b>Webhook URL</b> and <b>JSON template</b> from the pairing page, sender <code>*</code>, and <b>Store failed messages for retry</b> on.</li>
        <li>In Android settings, turn off battery optimization for the app so alerts aren&apos;t delayed.</li>
      </ol>
      <p className="small muted">Closed the pairing page before copying? Remove the phone below and connect it again: a new key takes a minute.</p>
    </div>
  );
}
