// AI savings ideas: turns the savings plan into a short summary for OpenAI, and reads the ideas it sends back.
// Pure functions, so what leaves the server can be tested without a database or network.
//
// Only totals leave the server: usual income and spending, spending by category, monthly totals, this month so far,
// the target, money set aside, the balance, and the names and amounts of monthly payments. Never SMS text, account
// numbers, transaction payees or the owner's name.

import type { SavingsPlan } from "./savings";

type ReadyPlan = Extract<SavingsPlan, { ready: true }>;

/** Whole units of the currency (rupees, dollars), so the model reads plain numbers. */
const units = (paisa: number) => Math.round(paisa / 100);

export type AiSummaryExtra = {
  /** ISO code, e.g. "PKR". */
  currency: string;
  /** Balance less money set aside, in paisa; null when no balance has been set. */
  freeToSpend: number | null;
  /** Total balance, in paisa; null when no balance has been set. */
  balance: number | null;
  /** Monthly payments still running. */
  recurring: { name: string; amount: number | null; category: string }[];
  /** Set when the plan covers one bank (or cash) only. */
  scope?: "one bank" | "cash";
};

/** Keeps a free-text name short and free of digits long enough to be an account or card number. */
export function cleanName(name: string) {
  return name.replace(/\d[\d\s-]{5,}\d/g, "•••").replace(/\s+/g, " ").trim().slice(0, 40);
}

export function buildAiSummary(p: ReadyPlan, x: AiSummaryExtra) {
  return {
    currency: x.currency,
    scope: x.scope ?? "all accounts",
    today: p.today,
    months_of_history: p.monthsUsed,
    usual_month: {
      income: units(p.usual.income),
      spending: units(p.usual.spend),
      left_over: units(p.usual.saved),
      fixed_costs: units(p.usual.fixed),
      flexible_costs: units(p.usual.flexible),
      income_is_uneven: p.uneven,
    },
    spending_by_category: p.categories.slice(0, 15).map((c) => ({
      category: c.category,
      usual_per_month: units(c.usual),
      last_month: units(c.last),
      fixed: c.fixed,
    })),
    recent_months: p.history.map((h) => ({ month: h.month, income: units(h.income), spending: units(h.spend), left_over: units(h.saved) })),
    this_month: {
      day: p.thisMonth.day,
      days_in_month: p.thisMonth.days,
      income_so_far: units(p.thisMonth.income),
      spending_so_far: units(p.thisMonth.spend),
    },
    monthly_payments: x.recurring
      .filter((r) => r.amount && r.amount > 0)
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
      .slice(0, 15)
      .map((r) => ({ name: cleanName(r.name), category: r.category, amount: units(r.amount!) })),
    savings: {
      monthly_target: units(p.target),
      target_set_by_owner: p.targetIsOwn,
      realistic_monthly_saving: units(p.suggested),
      already_set_aside: units(p.saved),
      emergency_fund_goal: units(p.emergencyGoal),
    },
    balance: x.balance == null ? null : units(x.balance),
    free_to_spend: x.freeToSpend == null ? null : units(x.freeToSpend),
    tips_already_shown: p.tips.map((t) => t.title),
  };
}

export type AiSummary = ReturnType<typeof buildAiSummary>;

export const AI_SYSTEM_PROMPT = [
  "You are a careful personal finance coach inside Mizan, an expense tracker used mostly in Pakistan.",
  "You get a summary of one person's own money: usual income and spending by category, recent months, monthly payments, savings and balance.",
  "Give 4 to 6 specific, practical suggestions to save more and grow their money, based on these numbers.",
  "Mix saving ideas (where their own figures show room to cut) with growth ideas (emergency fund first, then options such as",
  "National Savings certificates, bank savings accounts, mutual funds or other low-cost, regulated choices that suit the currency and country).",
  "Respect Islamic finance: when suggesting where to keep or grow money, include a Shariah-compliant option where one fits.",
  "Quote their own figures, in the given currency, rounded. Don't repeat the tips already shown; add something new.",
  "Never promise returns, never name a specific stock or coin, and keep risky ideas out. Fixed costs (rent, bills, school, health, tax, giving) are not cuts.",
  "Write plain, friendly English. Each detail is two or three short sentences.",
].join(" ");

/** The shape OpenAI is asked to answer in (structured outputs). */
export const AI_SCHEMA = {
  name: "savings_ideas",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "ideas"],
    properties: {
      summary: { type: "string", description: "One or two sentences on how their money is doing." },
      ideas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "title", "detail", "monthly_amount"],
          properties: {
            kind: { type: "string", enum: ["save", "grow", "protect"] },
            title: { type: "string", description: "Short, starts with a verb." },
            detail: { type: "string" },
            monthly_amount: { type: ["number", "null"], description: "Rough amount a month this saves or puts to work, in whole currency units; null if it can't be put as a number." },
          },
        },
      },
    },
  },
} as const;

export type AiIdea = { kind: "save" | "grow" | "protect"; title: string; detail: string; monthly: number | null };
export type AiIdeas = { summary: string; ideas: AiIdea[] };

const KINDS = new Set(["save", "grow", "protect"]);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Reads the model's JSON answer. Amounts come back in whole units and are stored in paisa. Returns null when unusable. */
export function parseAiIdeas(raw: string): AiIdeas | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as { summary?: unknown; ideas?: unknown };
  if (!Array.isArray(d.ideas)) return null;
  const ideas: AiIdea[] = d.ideas
    .slice(0, 8)
    .map((i: Record<string, unknown>) => ({
      kind: (KINDS.has(i?.kind as string) ? i.kind : "save") as AiIdea["kind"],
      title: text(i?.title, 120),
      detail: text(i?.detail, 600),
      monthly: typeof i?.monthly_amount === "number" && Number.isFinite(i.monthly_amount) && i.monthly_amount > 0 ? Math.round(i.monthly_amount) * 100 : null,
    }))
    .filter((i) => i.title && i.detail);
  if (!ideas.length) return null;
  return { summary: text(d.summary, 400), ideas };
}
