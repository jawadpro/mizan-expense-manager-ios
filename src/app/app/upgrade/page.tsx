import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { PRO_FEATURES } from "@/lib/plans";
import "../../settings.css";
import Checkout, { CancelTest, ManageBilling } from "./Checkout";
import { testModeOn } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans" };

type Sub = { provider_subscription_id: string | null; status: string; billing_interval: string | null; current_period_end: string | null; ends_at: string | null };

const FREE = ["Add income and spending by hand", "Dashboard, trends and categories", "Transactions, calendar and recipients", "Live bank balance", "CSV export"];

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

/** Free vs Pro, Paddle checkout, and the billing portal for subscribers. */
export default async function UpgradePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const welcome = (await searchParams).welcome === "1";
  const user = await getUser().catch(() => null);
  if (!user) redirect("/login");
  const { rows } = await q<Sub & { comp: boolean; comp_until: string | null }>(
    `SELECT s.provider_subscription_id, s.status, s.billing_interval, s.current_period_end, s.ends_at,
            (u.comp_plan = 'pro' AND (u.comp_until IS NULL OR u.comp_until > now())) AS comp, u.comp_until
     FROM app.users u LEFT JOIN LATERAL (
       SELECT * FROM app.subscriptions x WHERE x.user_id = u.id ORDER BY x.updated_at DESC LIMIT 1
     ) s ON true WHERE u.id = $1`,
    [user.id],
  );
  const info = rows[0];
  const pro = user.plan === "pro";
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{pro ? "Your plan" : "Upgrade to Pro"}</h1>
          <p className="muted">{pro ? "You're on Mizan Pro. Thank you!" : "Mizan is free for tracking by hand. Pro does the typing for you."}</p>
          {welcome && pro && <div className="alert" style={{ marginTop: 10 }}>Welcome to Pro! Set up automatic SMS import from <a href="/app/sms">SMS setup</a>.</div>}
        </div>
      </div>
      <div className="grid plans-grid" style={{ gap: 16, maxWidth: 820 }}>
        <section className="card">
          <h2>Free</h2>
          <ul className="plan-list">{FREE.map((f) => <li key={f}>{f}</li>)}</ul>
          {!pro && <p className="small muted">Your current plan.</p>}
        </section>
        <section className="card plan-pro">
          <h2>Pro</h2>
          <p className="small muted">Everything in Free, plus:</p>
          <ul className="plan-list">{Object.values(PRO_FEATURES).map((f) => <li key={f}>{f}</li>)}</ul>
          {pro && (
            <p className="small">
              {info?.comp ? <>Pro was given to this account{info.comp_until ? ` until ${day(info.comp_until)}` : ""}.</>
                : info?.status ? <>{info.status === "trialing" ? "Free trial, then billed" : "Billed"} {info.billing_interval === "year" ? "yearly" : "monthly"}.{info.ends_at ? ` Ends on ${day(info.ends_at)}.` : info.current_period_end ? ` ${info.status === "trialing" ? "First payment" : "Renews"} on ${day(info.current_period_end)}.` : ""}{info.status === "past_due" ? " Your last payment didn't go through; update your card to keep Pro." : ""}</>
                : null}
            </p>
          )}
          {pro && !info?.comp && info?.status && (info.provider_subscription_id?.startsWith("test_")
            ? testModeOn() && <CancelTest />
            : <ManageBilling />)}
          {!pro && <Checkout />}
        </section>
      </div>
    </>
  );
}
