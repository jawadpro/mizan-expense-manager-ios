"use client";
import { useState } from "react";
import { formatPaisa } from "@/lib/money";
import type { AiIdea, AiIdeas } from "@/lib/ai-savings";
import { apiFetch } from "./api";
import { useData } from "./useData";

type Last = AiIdeas & { at: string; model: string };
type AiData = { ok: true; configured: boolean; last: Last | null };

const rs = (p: number) => formatPaisa(Math.round(p)).replace(/\.\d\d$/, "");
const KIND: Record<AiIdea["kind"], { label: string; tone: string }> = {
  save: { label: "Save", tone: "info" },
  grow: { label: "Grow", tone: "grow" },
  protect: { label: "Protect", tone: "ok" },
};
const when = (iso: string) =>
  new Date(iso).toLocaleString("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });

/** Ideas from OpenAI, worked out from the savings plan's totals. Runs only when the owner asks. */
export default function AiSavingsIdeas({ bank }: { bank: string }) {
  const url = bank ? `/api/savings/ai?bank=${encodeURIComponent(bank)}` : "/api/savings/ai";
  const { data, setData } = useAi(url);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!data) return null;

  async function ask() {
    setBusy(true);
    setErr(null);
    try {
      setData(await apiFetch<AiData>(url, { method: "POST" }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const last = data.last;
  return (
    <section className="card sv-tips sv-ai">
      <div className="card-head">
        <h2>Ideas from AI</h2>
        {data.configured && (
          <button className="btn sm" onClick={ask} disabled={busy}>
            {busy ? "Thinking…" : last ? "Refresh ideas" : "Get AI suggestions"}
          </button>
        )}
      </div>
      {!data.configured ? (
        <p className="small muted" style={{ margin: 0 }}>
          Add an OpenAI API key (<code>OPENAI_API_KEY</code>) to the server&apos;s environment to get personal ideas for saving more and growing your money.
        </p>
      ) : !last ? (
        <p className="small muted" style={{ margin: 0 }}>
          Get a few personal ideas for saving more and growing your money. Only the totals on this page are sent to OpenAI: income, spending by category, monthly payments, your target and balance. No messages, account numbers or payees.
        </p>
      ) : (
        <>
          {last.summary && <p className="sv-ai-summary">{last.summary}</p>}
          <div className="tips">
            {last.ideas.map((t, i) => (
              <div key={i} className={`tip ${KIND[t.kind].tone}`}>
                <div className="tip-body">
                  <div className="tip-title">
                    <span className="sv-ai-kind">{KIND[t.kind].label}</span>
                    {t.title}
                    {t.monthly ? <span className="sv-save num">~{rs(t.monthly)}/mo</span> : null}
                  </div>
                  <div className="tip-detail">{t.detail}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ margin: "10px 0 0" }}>
            From {when(last.at)}. AI can be wrong: check the figures, and talk to an adviser before investing.
          </p>
        </>
      )}
      {err && <div className="alert error" style={{ marginTop: 10 }} role="alert">{err}</div>}
    </section>
  );
}

function useAi(url: string) {
  const { data } = useData<AiData>(url);
  const [fresh, setFresh] = useState<{ url: string; d: AiData } | null>(null);
  return { data: fresh?.url === url ? fresh.d : data, setData: (d: AiData) => setFresh({ url, d }) };
}
