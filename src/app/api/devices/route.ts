import { requireSession } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { anyPhoneConnected, isDeviceKind, latestPairing, listDevices, phoneUrl, shortcutConfig } from "@/lib/paired-devices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paired iPhones (or with ?kind=widget or ?kind=android, widgets or Android phones), the state of the latest pairing
 * code, what the setup needs, and whether any phone at all is connected (anyPhone, for the menu).
 */
export const GET = handle(async (req: Request) => {
  await requireSession(req);
  const k = new URL(req.url).searchParams.get("kind");
  const kind = isDeviceKind(k) ? k : "shortcut";
  const [items, pairing, anyPhone] = await Promise.all([listDevices(kind), latestPairing(kind), anyPhoneConnected()]);
  return json({ ok: true, items, pairing, anyPhone, shortcut: shortcutConfig(), phoneUrl: phoneUrl(req) });
});
