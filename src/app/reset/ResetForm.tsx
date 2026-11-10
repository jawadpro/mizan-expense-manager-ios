"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/components/api";

const MIN = 10;

export default function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!token) return <div className="alert error" style={{ marginTop: 18 }}>This link is incomplete. <Link href="/forgot">Ask for a new one.</Link></div>;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password: pw }) });
      window.location.href = "/app";
    } catch (ex) {
      setErr((ex as Error).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
      <label className="field">New password
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required autoFocus />
        {pw.length > 0 && pw.length < MIN && <span className="hint">{MIN - pw.length} more characters</span>}
      </label>
      <label className="field">Type it again
        <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
        {again.length > 0 && again !== pw && <span className="hint">Doesn&apos;t match yet</span>}
      </label>
      {err && <div className="alert error" role="alert">{err} <Link href="/forgot">Ask for a new link.</Link></div>}
      <button className="btn primary" disabled={busy || pw.length < MIN || again !== pw} style={{ justifyContent: "center" }}>{busy ? "Saving…" : "Save and sign in"}</button>
    </form>
  );
}
