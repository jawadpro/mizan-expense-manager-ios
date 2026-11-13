import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { latestPairing, listDevices, phoneUrl, shortcutConfig } from "@/lib/devices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in user's iPhones, the state of their latest pairing code, and what the iPhone setup needs. */
export const GET = handle(async (req: Request) => {
  await requireUser(req);
  const [items, pairing] = await Promise.all([listDevices(), latestPairing()]);
  return json({ ok: true, items, pairing, legacyToken: false, shortcut: shortcutConfig(), phoneUrl: phoneUrl(req) });
});
