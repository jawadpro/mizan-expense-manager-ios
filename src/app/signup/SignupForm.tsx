"use client";
import Link from "next/link";
import { useState } from "react";
import { apiFetch, ApiError } from "@/components/api";

const MIN = 10;

export default function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setFields({});
    try {
      await apiFetch("/api/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password: pw }) });
      window.location.href = "/app";
    } catch (ex) {
      setErr((ex as Error).message);
      if (ex instanceof ApiError && ex.fields) setFields(ex.fields);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
      <label className="field">Name
        <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
      </label>
      <label className="field">Email
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {fields.email && <span className="hint">{fields.email[0]}</span>}
      </label>
      <label className="field">Password
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {pw.length > 0 && pw.length < MIN && <span className="hint">{MIN - pw.length} more characters</span>}
      </label>
      {err && <div className="alert error" role="alert">{err}</div>}
      <button className="btn primary" disabled={busy || !email || pw.length < MIN} style={{ justifyContent: "center" }}>{busy ? "Creating…" : "Create account"}</button>
      <p className="muted" style={{ textAlign: "center", margin: 0 }}>Already have an account? <Link href="/login">Sign in</Link></p>
    </form>
  );
}
