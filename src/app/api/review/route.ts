import { requirePro } from "@/lib/plans";
import { handle } from "@/lib/http";
import { getReview } from "@/lib/handlers";

export const dynamic = "force-dynamic";
export const GET = handle(async (req: Request) => {
  await requirePro(req, "sms");
  return getReview("app");
});
