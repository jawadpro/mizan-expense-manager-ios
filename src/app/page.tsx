import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { setupState } from "@/lib/config";

export const dynamic = "force-dynamic";

/** No landing page yet: go straight to the workspace, to sign-in, or to setup on a new install. */
export default async function Home() {
  const state = await setupState();
  if (!state.hasOwner && !state.legacyPassphrase) redirect("/setup");
  const user = await getUser().catch(() => null);
  redirect(user ? (user.onboarded_at ? "/app" : "/setup") : "/login");
}
