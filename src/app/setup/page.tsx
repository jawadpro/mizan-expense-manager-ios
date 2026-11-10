import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { setupState } from "@/lib/config";
import { ToastProvider } from "@/components/Toast";
import SetupWizard from "./SetupWizard";
import "../extra.css";
import "../settings.css";
import "../setup.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up Mizan" };

/** First run: database check and admin account on a new install, then each account's banks, name and iPhone Shortcut. */
export default async function SetupPage() {
  const state = await setupState();
  // An install from before accounts: its owner creates the admin account from the sign-in page.
  if (state.legacyPassphrase) redirect("/login");
  const user = state.hasOwner ? await getUser().catch(() => null) : null;
  if (state.hasOwner && !user) redirect("/login");
  if (user?.onboarded_at) redirect("/app");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "your-app.vercel.app";
  return (
    <ToastProvider>
      <SetupWizard db={state.db} hasOwner={state.hasOwner} endpoint={`https://${host}/api/sms`} />
    </ToastProvider>
  );
}
