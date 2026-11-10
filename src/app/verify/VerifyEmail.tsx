"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/components/api";

/** Confirms the address from the emailed link. Runs once: the token can only be used one time. */
export default function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "ok" | "error">(token ? "working" : "error");
  const [err, setErr] = useState(token ? "" : "This link is incomplete.");
  const ran = useRef(false);
  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    apiFetch("/api/auth/verify", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => setState("ok"))
      .catch((e) => {
        setErr((e as Error).message);
        setState("error");
      });
  }, [token]);
  if (state === "working") return <p className="muted" style={{ marginTop: 18 }}>Confirming…</p>;
  if (state === "ok") return <div style={{ marginTop: 18 }}><div className="alert">Your email is confirmed. Thank you!</div><p><Link href="/app">Open Mizan</Link></p></div>;
  return <div style={{ marginTop: 18 }}><div className="alert error" role="alert">{err}</div><p><Link href="/login">Sign in</Link></p></div>;
}
