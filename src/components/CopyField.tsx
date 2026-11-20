"use client";
import { useState } from "react";

/** A read-only value with a Copy button, for pasting into another app. */
export default function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="copy-field">
      <div className="copy-field-head"><span className="small"><b>{label}</b></span><button type="button" className="btn sm" onClick={copy}>{copied ? "Copied" : "Copy"}</button></div>
      {multiline
        ? <textarea readOnly value={value} rows={5} className="mono" onFocus={(e) => e.currentTarget.select()} aria-label={label} />
        : <input readOnly value={value} className="mono" onFocus={(e) => e.currentTarget.select()} aria-label={label} />}
    </div>
  );
}
