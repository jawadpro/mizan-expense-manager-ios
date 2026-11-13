import { applySubscriptionEvent, verifyPaddleSignature } from "@/lib/billing";
import { errorJson, handle, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 256 * 1024;

/**
 * Paddle notification destination. Set its URL to https://<your app>/api/billing/webhook and subscribe it to
 * the subscription.* events. Only a correctly signed, recent request changes anything.
 */
export const POST = handle(async (req: Request) => {
  const secret = process.env.PADDLE_WEBHOOK_SECRET ?? "";
  if (!secret) return errorJson(503, "Billing isn't set up on this server");
  if (Number(req.headers.get("content-length") ?? "0") > MAX_BYTES) return errorJson(413, "Too large");
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return errorJson(413, "Too large");
  if (!verifyPaddleSignature(raw, req.headers.get("paddle-signature"), secret)) return errorJson(401, "Bad signature");
  let event: { event_type?: string; data?: unknown };
  try {
    event = JSON.parse(raw);
  } catch {
    return errorJson(400, "Bad JSON");
  }
  if (!event.event_type?.startsWith("subscription.")) return json({ ok: true, result: "ignored" });
  const result = await applySubscriptionEvent(event.data as Parameters<typeof applySubscriptionEvent>[0]);
  if (result === "unknown-user") console.error("[mizan] paddle webhook for a subscription with no known account");
  // 200 even for an event we can't place, so Paddle doesn't retry it forever.
  return json({ ok: true, result });
});
