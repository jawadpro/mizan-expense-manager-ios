import { requireUser } from "@/lib/auth";
import { billingConfig, checkoutReady, testModeOn } from "@/lib/billing";
import { handle, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the plans page needs to open a Paddle checkout for the signed-in account. Nothing secret. */
export const GET = handle(async (req: Request) => {
  const { user } = await requireUser(req);
  const c = billingConfig();
  return json({
    ok: true,
    ready: checkoutReady(),
    testMode: testModeOn(),
    env: c.env,
    clientToken: c.clientToken,
    prices: c.prices,
    labels: c.labels,
    trialDays: c.trialDays,
    email: user.email,
    userId: user.id,
    plan: user.plan,
  });
});
