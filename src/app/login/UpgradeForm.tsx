"use client";
import { useState } from "react";
import { apiFetch, ApiError } from "@/components/api";

const MIN = 10;

/** An install from before accounts: the old passphrase, then the email and password used from now on. */
export default function UpgradeForm() {
  const [passphrase, setPassphrase] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const short = pw.length > 0 && pw.length < MIN;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setFields({});
    try {
      await apiFetch("/api/auth/upgrade", { method: "POST", body: JSON.stringify({ passphrase, email, password: pw, remember: true }) });
      window.location.href = "/app";
    } catch (ex) {
      setErr((ex as Error).message);
      if (ex instanceof ApiError && ex.fields) setFields(ex.fields);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
      <label className="field">Your current passphrase
        <input type="password" autoComplete="current-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} required autoFocus />
        {fields.passphrase && <span className="hint">{fields.passphrase[0]}</span>}
      </label>
      <label className="field">Email
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="field">New password
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {short && <span className="hint">{MIN - pw.length} more characters</span>}
      </label>
      <label className="field">Type it again
        <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
        {again.length > 0 && again !== pw && <span className="hint">Doesn&apos;t match yet</span>}
      </label>
      {err && <div className="alert error" role="alert">{err}</div>}
      <button className="btn primary" disabled={busy || !passphrase || !email || pw.length < MIN || again !== pw} style={{ justifyContent: "center" }}>
        {busy ? "Saving…" : "Create my account"}
      </button>
    </form>
  );
}
