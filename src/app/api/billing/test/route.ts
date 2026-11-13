import { requireUser } from "@/lib/auth";
import { simulateSubscription, testModeOn } from "@/lib/billing";
import { HttpError, handle, json, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Test mode only (BILLING_TEST_MODE=true and no Paddle keys): pretend to subscribe or cancel. */
export const POST = handle(async (req: Request) => {
  if (!testModeOn()) throw new HttpError(404, "Not found");
  const { user } = await requireUser(req);
  const body = (await readJson(req, 256)) as { action?: unknown };
  const action = body?.action;
  if (action !== "month" && action !== "year" && action !== "cancel") throw new HttpError(400, "Pick month, year or cancel");
  await simulateSubscription(user.id, action);
  return json({ ok: true });
});
