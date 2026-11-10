import { Suspense } from "react";
import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { SIGNUPS_OPEN } from "@/lib/account";
import { getUser } from "@/lib/auth";
import { setupState } from "@/lib/config";
import LoginForm from "./LoginForm";
import UpgradeForm from "./UpgradeForm";
import "../extra.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const state = await setupState();
  if (!state.hasOwner && !state.legacyPassphrase) redirect("/setup");
  let signedIn = false;
  try {
    signedIn = !!(await getUser());
  } catch {
    signedIn = false;
  }
  if (signedIn) redirect("/app");
  if (state.legacyPassphrase) {
    return (
      <AuthCard title="Mizan now uses accounts" subtitle="Sign in one last time with your passphrase, then choose the email and password you'll use from now on. All your data moves into this account.">
        <UpgradeForm />
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Welcome back" subtitle="Sign in to open your finances.">
      <Suspense><LoginForm signupsOpen={SIGNUPS_OPEN} /></Suspense>
    </AuthCard>
  );
}
