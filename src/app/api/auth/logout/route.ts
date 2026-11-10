import { assertSameOrigin, clearSessionHeaders } from "@/lib/auth";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  return new Response(JSON.stringify({ ok: true }), { headers: clearSessionHeaders() });
});
