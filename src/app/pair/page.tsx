import { headers } from "next/headers";
import AuthCard from "@/components/AuthCard";
import { shortcutConfig } from "@/lib/devices";
import PairLauncher from "./PairLauncher";
import "../setup.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect your iPhone", robots: { index: false, follow: false } };

/** Opened on the iPhone from the pairing QR code. The one-time code is in the #fragment; no sign-in needed. */
export default async function PairPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const server = process.env.APP_URL?.replace(/\/$/, "") || `${proto}://${host}`;
  const sc = shortcutConfig();
  return (
    <AuthCard title="Connect this iPhone to Mizan" subtitle="One tap and this iPhone can send your bank alerts to your Mizan account.">
      <PairLauncher server={server} shortcutName={sc.name} shortcutUrl={sc.url} />
    </AuthCard>
  );
}
