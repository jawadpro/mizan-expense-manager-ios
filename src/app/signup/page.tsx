import { notFound, redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { SIGNUPS_OPEN } from "@/lib/account";
import { getUser } from "@/lib/auth";
import { setupState } from "@/lib/config";
import SignupForm from "./SignupForm";
import "../extra.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (!SIGNUPS_OPEN) notFound();
  if (!(await setupState()).hasOwner) redirect("/setup");
  if (await getUser().catch(() => null)) redirect("/app");
  return (
    <AuthCard title="Create your account" subtitle="Free forever for tracking by hand. Upgrade any time for automatic imports.">
      <SignupForm />
    </AuthCard>
  );
}
