import { requireUser } from "@/lib/auth";
import { publicUser } from "@/lib/account";
import { handle, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const { user } = await requireUser(req);
  return json({ ok: true, user: publicUser(user) });
});
