import { headers } from "next/headers";
import AndroidPairLauncher from "./AndroidPairLauncher";
import "../../extra.css";
import "../../setup.css";
import BrandMark from "@/components/BrandMark";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect your Android phone", robots: { index: false, follow: false } };

/** Opened on the Android phone from the QR code in Connect phone › Android. The one-time code is in the #fragment; no sign-in needed. */
export default async function AndroidPairPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  const server = process.env.APP_URL?.trim().replace(/\/$/, "") || `${proto}://${host}`;
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="brand" style={{ marginBottom: 12 }}><BrandMark /> Mizan</div>
        <h1 style={{ fontSize: "1.5rem" }}>Connect this Android phone</h1>
        <p className="muted" style={{ marginTop: 4 }}>This phone will forward your bank SMS to Mizan by itself, as they arrive.</p>
        <AndroidPairLauncher server={server} />
      </div>
    </div>
  );
}
