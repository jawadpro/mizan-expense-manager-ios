"use client";
import Link from "next/link";
import { createContext, useContext } from "react";

export type Plan = "free" | "pro";

/** What each Pro feature is called on an upgrade prompt. Kept in step with PRO_FEATURES in lib/plans.ts. */
export const PRO_LABEL = {
  sms: "Automatic SMS import",
  multiBank: "More than one bank",
  push: "Push notifications",
  backup: "Nightly Google Drive backups",
  monthly: "Monthly payments",
  spending: "Spending limits",
  setAsides: "Set-asides",
  zakat: "Zakat",
} as const;
export type ProFeature = keyof typeof PRO_LABEL;

const PlanContext = createContext<Plan>("free");

export function PlanProvider({ plan, children }: { plan: Plan; children: React.ReactNode }) {
  return <PlanContext.Provider value={plan}>{children}</PlanContext.Provider>;
}

export function usePlan(): { plan: Plan; pro: boolean } {
  const plan = useContext(PlanContext);
  return { plan, pro: plan === "pro" };
}

export function ProBadge() {
  return <span className="pro-badge">Pro</span>;
}

/** A card that explains a Pro feature and links to the upgrade page. */
export function UpgradeCard({ feature, compact }: { feature: ProFeature; compact?: boolean }) {
  return (
    <div className={`card upgrade-card${compact ? " compact" : ""}`}>
      <div className="upgrade-head"><ProBadge /> <strong>{PRO_LABEL[feature]}</strong></div>
      <p className="muted">
        {PRO_LABEL[feature]} is part of Mizan Pro. Pro also reads your bank&apos;s SMS alerts for you, so payments show up without typing.
      </p>
      <Link className="btn primary" href="/app/upgrade">See Pro plans</Link>
    </div>
  );
}

/** Shows children on Pro, and an upgrade card on Free. The server enforces the same rule on every API call. */
export function ProOnly({ feature, title, children }: { feature: ProFeature; title?: string; children: React.ReactNode }) {
  const { pro } = usePlan();
  if (pro) return <>{children}</>;
  return (
    <>
      {title && <div className="page-head"><div><h1>{title}</h1></div></div>}
      <UpgradeCard feature={feature} />
    </>
  );
}
