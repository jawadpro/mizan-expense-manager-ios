"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/components/api";

type Config = {
  ready: boolean;
  testMode: boolean;
  env: "sandbox" | "production";
  clientToken: string | null;
  prices: { month: string | null; year: string | null };
  labels: { month: string; year: string };
  trialDays: number;
  email: string;
  userId: string;
  plan: "free" | "pro";
};

type PaddleGlobal = {
  Environment: { set: (env: string) => void };
  Initialize: (o: { token: string; eventCallback?: (e: { name?: string }) => void }) => void;
  Checkout: { open: (o: unknown) => void };
};
declare global {
  interface Window { Paddle?: PaddleGlobal }
}

const PADDLE_JS = "https://cdn.paddle.com/paddle/v2/paddle.js";

function loadPaddle(): Promise<PaddleGlobal> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PADDLE_JS;
    s.async = true;
    s.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error("Paddle didn't load")));
    s.onerror = () => reject(new Error("Couldn't load the payment form. Check your connection."));
    document.head.appendChild(s);
  });
}

/** Monthly and yearly buttons that open Paddle's checkout. After paying, waits for the webhook to switch the plan. */
export default function Checkout() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"month" | "year" | null>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    apiFetch<Config>("/api/billing/checkout").then(setCfg).catch((e) => setErr((e as Error).message));
  }, []);

  // Paddle tells us about the payment by webhook, a few seconds after checkout closes.
  useEffect(() => {
    if (!waiting) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const me = await apiFetch<{ user: { plan: string } }>("/api/auth/me").catch(() => null);
      if (me?.user.plan === "pro") {
        clearInterval(t);
        window.location.href = "/app/upgrade?welcome=1";
      } else if (tries > 30) {
        clearInterval(t);
        setWaiting(false);
        setErr("Your payment went through, but Pro hasn't switched on yet. Refresh this page in a minute.");
      }
    }, 2000);
    return () => clearInterval(t);
  }, [waiting]);

  async function open(interval: "month" | "year") {
    if (!cfg?.ready || !cfg.clientToken) return;
    const priceId = cfg.prices[interval];
    if (!priceId) return;
    setBusy(interval);
    setErr(null);
    try {
      const paddle = await loadPaddle();
      paddle.Environment.set(cfg.env === "production" ? "production" : "sandbox");
      paddle.Initialize({
        token: cfg.clientToken,
        eventCallback: (e) => {
          if (e.name === "checkout.completed") setWaiting(true);
        },
      });
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: { email: cfg.email },
        customData: { user_id: cfg.userId },
        settings: { displayMode: "overlay", theme: "light", allowLogout: false },
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function simulate(interval: "month" | "year") {
    setBusy(interval);
    setErr(null);
    try {
      await apiFetch("/api/billing/test", { method: "POST", body: JSON.stringify({ action: interval }) });
      window.location.href = "/app/upgrade?welcome=1";
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }

  if (!cfg && !err) return <p className="small muted">Loading prices…</p>;
  if (cfg && !cfg.ready && cfg.testMode) {
    return (
      <div className="plan-buttons">
        <div className="alert warn">Test mode: Paddle isn&apos;t connected, so these buttons switch Pro on without any payment.</div>
        <button className="btn primary" onClick={() => simulate("month")} disabled={!!busy}>{busy === "month" ? "Switching on…" : `Simulate ${cfg.labels.month} / month`}</button>
        <button className="btn" onClick={() => simulate("year")} disabled={!!busy}>{busy === "year" ? "Switching on…" : `Simulate ${cfg.labels.year} / year`}</button>
        {err && <div className="alert error" role="alert">{err}</div>}
      </div>
    );
  }
  if (waiting) return <div className="alert">Payment received. Switching on Pro…</div>;
  return (
    <div className="plan-buttons">
      {cfg && (
        <>
          <button className="btn primary" onClick={() => open("month")} disabled={!cfg.ready || !!busy}>
            {busy === "month" ? "Opening…" : `${cfg.labels.month} / month`}
          </button>
          <button className="btn" onClick={() => open("year")} disabled={!cfg.ready || !!busy}>
            {busy === "year" ? "Opening…" : `${cfg.labels.year} / year`}
          </button>
          <p className="small muted">
            {cfg.trialDays > 0 ? `Try Pro free for ${cfg.trialDays} days. ` : ""}Cancel any time. Payments are handled securely by Paddle.
          </p>
          {!cfg.ready && <div className="alert warn" role="status">Payments aren&apos;t switched on yet, so you can&apos;t upgrade here. The site owner needs to connect Paddle first.</div>}
        </>
      )}
      {err && <div className="alert error" role="alert">{err}</div>}
    </div>
  );
}

/** Test mode: ends the pretend subscription. */
export function CancelTest() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    try {
      await apiFetch("/api/billing/test", { method: "POST", body: JSON.stringify({ action: "cancel" }) });
      window.location.reload();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="plan-buttons">
      <button className="btn" onClick={go} disabled={busy}>{busy ? "Cancelling…" : "Cancel test subscription"}</button>
      {err && <div className="alert error" role="alert">{err}</div>}
    </div>
  );
}

/** For subscribers: opens Paddle's portal to change plan, update the card or cancel. */
export function ManageBilling() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const { url } = await apiFetch<{ url: string }>("/api/billing/portal", { method: "POST" });
      window.location.href = url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="plan-buttons">
      <button className="btn" onClick={go} disabled={busy}>{busy ? "Opening…" : "Manage billing"}</button>
      {err && <div className="alert error" role="alert">{err}</div>}
    </div>
  );
}
