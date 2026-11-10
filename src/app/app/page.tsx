import BalanceCard from "@/components/BalanceCard";
import Dashboard from "@/components/Dashboard";
import MonthlyStrip from "@/components/MonthlyStrip";
import RamadanNotice from "@/components/RamadanNotice";
import { DEFAULT_PREFS } from "@/lib/preferences";
import { getPrefs } from "@/lib/repo";
import { getUser } from "@/lib/auth";
import { asUser } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getUser().catch(() => null);
  const prefs = user ? await asUser(user.id, getPrefs).catch(() => DEFAULT_PREFS) : DEFAULT_PREFS;
  return (
    <Dashboard
      space="app"
      defaultPreset={prefs.defaultRange}
      top={
        <>
          <div className="top-row">
            <BalanceCard />
          </div>
          <MonthlyStrip />
          {prefs.ramadanNotice && <RamadanNotice />}
        </>
      }
    />
  );
}
