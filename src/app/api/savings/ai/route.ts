import { requireSession } from "@/lib/auth";
import { AI_SCHEMA, AI_SYSTEM_PROMPT, buildAiSummary, parseAiIdeas, type AiIdeas } from "@/lib/ai-savings";
import { bankParam, showsForBank } from "@/lib/banks";
import { HttpError, handle, json } from "@/lib/http";
import { setDisplayCurrency } from "@/lib/money";
import { OpenAIError, chatJson, openaiConfig } from "@/lib/openai";
import { rateLimit } from "@/lib/ratelimit";
import { getBalances, getPrefs, listSetAsides, savingsData } from "@/lib/repo";
import { buildSavingsPlan } from "@/lib/savings";
import { getSecret, setSecret } from "@/lib/secretbox";
import { todayPkt } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Saved = AiIdeas & { at: string; model: string };

// The last answer is kept (encrypted, like other app secrets) per bank choice, so reopening the page costs nothing.
const slot = (bank: string) => `ai.savings.${bank || "all"}`;

async function readSaved(bank: string): Promise<Saved | null> {
  const raw = await getSecret(slot(bank)).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Saved;
  } catch {
    return null;
  }
}

/** GET ?bank= — whether AI ideas are set up, and the last ideas for this bank choice. */
export const GET = handle(async (req: Request) => {
  await requireSession(req);
  const bank = bankParam(new URL(req.url).searchParams.get("bank"));
  return json({ ok: true, configured: !!openaiConfig().key, last: await readSaved(bank) });
});

/** POST ?bank= — asks OpenAI for fresh ideas from this bank choice's savings plan, and keeps them. */
export const POST = handle(async (req: Request) => {
  await requireSession(req);
  if (!openaiConfig().key) throw new HttpError(503, "AI suggestions aren't set up yet. Add OPENAI_API_KEY to the server's environment.");
  // Each call costs money: a few an hour is plenty for one owner.
  if (!(await rateLimit("ai-savings", 10, 3600))) throw new HttpError(429, "That's a lot of requests in an hour. Try again later.");

  const bank = bankParam(new URL(req.url).searchParams.get("bank"));
  const today = todayPkt();
  const [data, funds, prefs, balances] = await Promise.all([savingsData(today, bank), listSetAsides(), getPrefs(), getBalances()]);
  setDisplayCurrency(prefs.currency);
  const shown = funds.filter((f) => showsForBank(f.bank_id, bank));
  const savingFunds = shown
    .filter((f) => f.purpose === "saving" && !f.ended_on)
    .map((f) => ({ id: f.id, name: f.name, percent_bp: f.percent_bp, applies_to: f.applies_to, remaining: f.remaining }));
  const target = bank ? prefs.savingsTargets[bank] ?? 0 : prefs.savingsTarget;
  const plan = buildSavingsPlan({ today, ...data, savingFunds, target });
  if (!plan.ready) throw new HttpError(409, "The plan needs at least one full month of records before AI can suggest anything.");

  const row = bank ? (bank === "none" ? null : balances.accounts.find((a) => a.bank_id === bank) ?? null) : balances.total;
  const setAside = shown.reduce((a, f) => a + Math.max(0, f.remaining), 0);
  const summary = buildAiSummary(plan, {
    currency: prefs.currency,
    balance: row?.balance ?? null,
    freeToSpend: row ? row.balance - setAside : null,
    recurring: bank ? [] : data.recurring,
    scope: bank === "none" ? "cash" : bank ? "one bank" : undefined,
  });

  let ideas: AiIdeas | null;
  let model: string;
  try {
    const res = await chatJson({ system: AI_SYSTEM_PROMPT, user: JSON.stringify(summary), schema: AI_SCHEMA });
    ideas = parseAiIdeas(res.content);
    model = res.model;
  } catch (e) {
    if (e instanceof OpenAIError) throw new HttpError(e.status, e.message);
    throw e;
  }
  if (!ideas) throw new HttpError(502, "OpenAI's answer couldn't be read. Try again.");

  const saved: Saved = { ...ideas, at: new Date().toISOString(), model };
  await setSecret(slot(bank), JSON.stringify(saved));
  return json({ ok: true, configured: true, last: saved });
});
