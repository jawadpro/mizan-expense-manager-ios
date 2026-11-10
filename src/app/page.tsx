import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { setupState } from "@/lib/config";

export const dynamic = "force-dynamic";

/** No landing page: go straight to the workspace, to sign-in, or to setup on a new install. */
export default async function Home() {
  const state = await setupState();
  if (!state.hasOwner && !state.legacyPassphrase) redirect("/setup");
  let ok = false;
  try {
    ok = !!(await getUser());
  } catch {
    ok = false;
  }
  redirect(ok ? (state.done ? "/app" : "/setup") : "/login");
}
