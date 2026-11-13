"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useData } from "./useData";

type Info = { smsToken: string | null; smsTokenFromEnv: boolean };

/**
 * A QR code to scan with the iPhone camera. It opens /connect on the phone with this account's Mizan URL and
 * SMS token, so the phone can add the Shortcuts and copy both values without typing. The token travels in the
 * URL's #fragment, which the browser never sends to a server or puts in logs.
 */
export default function PhoneQr() {
  const { data } = useData<Info>("/api/setup");
  const [svg, setSvg] = useState<string | null>(null);
  const token = data && !data.smsTokenFromEnv ? data.smsToken : null;

  useEffect(() => {
    if (!data) return;
    const url = `${window.location.origin}/connect${token ? `#t=${encodeURIComponent(token)}` : ""}`;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(null));
  }, [data, token]);

  return (
    <div className="phone-qr">
      <div className="phone-qr-code" aria-label="QR code to open Mizan's iPhone setup on your phone" role="img">
        {svg ? <span dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="small muted">Making QR code…</span>}
      </div>
      <div className="phone-qr-text">
        <strong>Scan with your iPhone camera</strong>
        <span className="small muted">
          It opens a page on your phone with both Shortcuts and one-tap buttons to copy your Mizan URL and SMS token, so there&apos;s nothing to type.
          {token ? " The code holds your SMS token: don't share it or post a photo of it." : ""}
        </span>
      </div>
    </div>
  );
}
