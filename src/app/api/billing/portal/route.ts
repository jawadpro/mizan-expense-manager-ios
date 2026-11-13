import { requireUser } from "@/lib/auth";
import { portalUrl } from "@/lib/billing";
import { HttpError, handle, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A one-time link to Paddle's customer portal (change plan, update card, cancel). */
export const POST = handle(async (req: Request) => {
  const { user } = await requireUser(req);
  if (!process.env.PADDLE_API_KEY) throw new HttpError(503, "Billing isn't set up on this server.");
  let url: string | null = null;
  try {
    url = await portalUrl(user.id);
  } catch (e) {
    console.error("[mizan] paddle portal failed", (e as Error)?.message);
    throw new HttpError(502, "Couldn't open the billing portal. Try again in a minute.");
  }
  if (!url) throw new HttpError(404, "There's no paid subscription on this account to manage.");
  return json({ ok: true, url });
});
