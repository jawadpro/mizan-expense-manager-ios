import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getUser } from "@/lib/auth";
import { asUser } from "@/lib/db";
import { DEFAULT_CURRENCY } from "@/lib/money";
import { getPrefs } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace" };

/** Server-side gate for the private workspace. API routes check the session independently. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser().catch(() => null);
  if (!user) redirect("/login");
  // A new account finishes the setup steps before the workspace opens.
  if (!user.onboarded_at) redirect("/setup");
  const currency = (await asUser(user.id, getPrefs).catch(() => null))?.currency ?? DEFAULT_CURRENCY;
  return <Shell space="app" currency={currency}>{children}</Shell>;
}
