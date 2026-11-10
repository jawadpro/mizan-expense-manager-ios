"use client";
import Link from "next/link";
import { useState } from "react";
import AuthCard from "@/components/AuthCard";
import { apiFetch } from "@/components/api";
import "../extra.css";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (sent) {
    return (
      <AuthCard title="Check your email" subtitle={<>If <b>{email}</b> has a Mizan account, we&apos;ve sent it a link to choose a new password. The link works for 1 hour.</>}>
        <p style={{ marginTop: 18 }}><Link href="/login">Back to sign in</Link></p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Reset your password" subtitle="Enter your account's email and we'll send you a link to choose a new password.">
      <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
        <label className="field">Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        {err && <div className="alert error" role="alert">{err}</div>}
        <button className="btn primary" disabled={busy || !email} style={{ justifyContent: "center" }}>{busy ? "Sending…" : "Send reset link"}</button>
        <p className="muted" style={{ textAlign: "center", margin: 0 }}><Link href="/login">Back to sign in</Link></p>
      </form>
    </AuthCard>
  );
}
