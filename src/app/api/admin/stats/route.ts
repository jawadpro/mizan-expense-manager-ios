import { requireAdmin } from "@/lib/auth";
import { getStats, recentEvents } from "@/lib/admin";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Headline numbers and the latest admin actions. */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const [stats, events] = [await getStats(), await recentEvents()];
  return json({ ok: true, stats, events });
});
