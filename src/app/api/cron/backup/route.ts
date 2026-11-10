import { safeEqual } from "@/lib/crypto";
import { asSystem, asUser, q } from "@/lib/db";
import { errorJson, handle, json } from "@/lib/http";
import { runBackup } from "@/lib/backup";
import { DRIVE_TOKEN_NAME } from "@/lib/gdrive";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Called once a night by Vercel Cron, which sends `Authorization: Bearer <CRON_SECRET>`. Backs up every account that connected Drive. */
export const GET = handle(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || secret.length < 32 || !safeEqual(auth, `Bearer ${secret}`)) return errorJson(401, "Unauthorized");
  const owners = await asSystem(async () =>
    (await q<{ user_id: string }>(
      `SELECT DISTINCT s.user_id FROM app.app_secrets s JOIN app.users u ON u.id = s.user_id
       WHERE s.name = $1 AND u.status = 'active'`,
      [DRIVE_TOKEN_NAME],
    )).rows.map((r) => r.user_id),
  );
  let ok = 0;
  for (const uid of owners) {
    const r = await asUser(uid, runBackup);
    if (r.ok) ok++;
  }
  return json({ ok: ok === owners.length, accounts: owners.length, backedUp: ok }, ok === owners.length ? 200 : 502);
});
