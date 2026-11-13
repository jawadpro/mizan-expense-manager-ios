import { requirePro } from "@/lib/plans";
import { errorJson, handle, json } from "@/lib/http";
import { fetchMetalPrices } from "@/lib/metals";
import { getPrefs } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requirePro(req, "zakat");
  try {
    const { currency } = await getPrefs();
    return json({ ok: true, ...(await fetchMetalPrices(currency)) });
  } catch {
    return errorJson(502, "Live prices are unavailable right now. Enter today's price by hand.");
  }
});
