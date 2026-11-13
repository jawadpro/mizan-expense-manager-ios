import { requireUser } from "@/lib/auth";
import { HttpError, handle, json, readJson } from "@/lib/http";
import { listBanks, saveBanks } from "@/lib/repo";
import { banksInput } from "@/lib/banks";
import { FREE_BANKS, isPro, proRequired } from "@/lib/plans";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireUser(req);
  return json({ ok: true, items: await listBanks() });
});

/** PUT { items: [...] } saves the whole list in order; rows keep their id so transactions stay tagged. */
export const PUT = handle(async (req: Request) => {
  const { user } = await requireUser(req);
  const parsed = banksInput.safeParse(await readJson(req, 32 * 1024));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Please check the banks");
  if (!isPro(user) && parsed.data.items.length > FREE_BANKS) throw proRequired("multiBank");
  return json({ ok: true, items: await saveBanks(parsed.data.items) });
});
