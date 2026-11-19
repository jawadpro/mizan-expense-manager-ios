import { describe, expect, it } from "vitest";
import { buildAiSummary, cleanName, parseAiIdeas } from "@/lib/ai-savings";
import { buildSavingsPlan, type SavingsInput } from "@/lib/savings";

const R = (rupees: number) => rupees * 100;
const month = (m: string, income: number, byCategory: Record<string, number>) => ({ month: m, income: R(income), byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, R(v)])) });
const input: SavingsInput = {
  today: "2026-11-15",
  months: [
    month("2026-09", 200000, { Rent: 60000, Groceries: 28000, "Food & dining": 14000 }),
    month("2026-10", 200000, { Rent: 60000, Groceries: 32000, "Food & dining": 17000 }),
  ],
  thisMonth: { income: R(200000), byCategory: { Rent: R(60000) } },
  recurring: [{ name: "Netflix", amount: R(1500), category: "Entertainment" }, { name: "Card 4111 1111 1111 1111", amount: R(900), category: "Bills" }],
  savingFunds: [],
  target: 0,
};
const plan = () => {
  const p = buildSavingsPlan(input);
  if (!p.ready) throw new Error("not ready");
  return p;
};

describe("AI savings summary", () => {
  it("sends totals in whole units, not paisa", () => {
    const s = buildAiSummary(plan(), { currency: "PKR", balance: R(350000), freeToSpend: R(300000), recurring: input.recurring });
    expect(s.usual_month.income).toBe(200000);
    expect(s.balance).toBe(350000);
    expect(s.spending_by_category.find((c) => c.category === "Rent")?.fixed).toBe(true);
    expect(s.monthly_payments[0]).toEqual({ name: "Netflix", category: "Entertainment", amount: 1500 });
  });

  it("masks long digit runs in payment names", () => {
    const s = buildAiSummary(plan(), { currency: "PKR", balance: null, freeToSpend: null, recurring: input.recurring });
    expect(JSON.stringify(s)).not.toMatch(/\d{4}[\s-]?\d{4}/);
    expect(cleanName("Card 4111 1111 1111 1111")).toBe("Card •••");
    expect(cleanName("PTCL 2026 plan")).toBe("PTCL 2026 plan");
  });
});

describe("parsing AI ideas", () => {
  it("reads ideas and stores amounts in paisa", () => {
    const r = parseAiIdeas(JSON.stringify({ summary: "Doing well.", ideas: [{ kind: "grow", title: "Open a savings account", detail: "Put the spare in.", monthly_amount: 5000 }, { kind: "save", title: "Cook more", detail: "Twice a week.", monthly_amount: null }] }));
    expect(r?.ideas).toEqual([
      { kind: "grow", title: "Open a savings account", detail: "Put the spare in.", monthly: R(5000) },
      { kind: "save", title: "Cook more", detail: "Twice a week.", monthly: null },
    ]);
  });

  it("drops empty ideas and rejects broken answers", () => {
    expect(parseAiIdeas("not json")).toBeNull();
    expect(parseAiIdeas(JSON.stringify({ ideas: [{ title: "", detail: "" }] }))).toBeNull();
    expect(parseAiIdeas(JSON.stringify({ summary: "x", ideas: [{ kind: "odd", title: "T", detail: "D", monthly_amount: -3 }] }))?.ideas[0]).toEqual({ kind: "save", title: "T", detail: "D", monthly: null });
  });
});
