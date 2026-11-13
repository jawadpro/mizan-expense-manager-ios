import { requireAdmin } from "@/lib/auth";
import { USER_FILTERS, listUsers, type UserFilter } from "@/lib/admin";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Accounts for the admin page: ?q= searches email and name, ?filter= narrows, ?page= pages by 50. */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const f = sp.get("filter") ?? "all";
  const filter = (USER_FILTERS as string[]).includes(f) ? (f as UserFilter) : "all";
  return json({ ok: true, ...(await listUsers({ search: sp.get("q") ?? "", filter, page: Number(sp.get("page") ?? "1") || 1 })) });
});
