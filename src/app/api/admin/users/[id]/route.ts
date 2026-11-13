import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { deleteUser, updateUser } from "@/lib/admin";
import { HttpError, handle, json, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function id(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) throw new HttpError(404, "No such account");
  return id;
}

const patchInput = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  role: z.enum(["user", "admin"]).optional(),
  comp: z.object({
    until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").nullable(),
    note: z.string().trim().max(200).nullable(),
  }).nullable().optional(),
  signOut: z.literal(true).optional(),
}).strict();

/** Suspend or reactivate, change role, give or take away free Pro, or sign out everywhere. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { user } = await requireAdmin(req);
  const target = await id(ctx);
  const parsed = patchInput.safeParse(await readJson(req, 2048));
  if (!parsed.success) throw new HttpError(400, "Please fix the highlighted fields", { fields: parsed.error.flatten().fieldErrors });
  const { comp, ...rest } = parsed.data;
  let compValue: { until: string | null; note: string | null } | null | undefined = comp;
  if (comp) {
    // Free Pro "until" a day lasts through the end of that day (UTC).
    const until = comp.until ? new Date(`${comp.until}T23:59:59Z`) : null;
    if (until && (Number.isNaN(until.getTime()) || until.getTime() < Date.now())) {
      throw new HttpError(400, "Please fix the highlighted fields", { fields: { until: ["Pick a date in the future"] } });
    }
    compValue = { until: until ? until.toISOString() : null, note: comp.note || null };
  }
  await updateUser(user, target, { ...rest, comp: compValue });
  return json({ ok: true });
});

/** Deletes the account and all its data. The body must repeat the account's email. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { user } = await requireAdmin(req);
  const target = await id(ctx);
  const body = (await readJson(req, 1024)) as { confirmEmail?: unknown };
  await deleteUser(user, target, typeof body?.confirmEmail === "string" ? body.confirmEmail : "");
  return json({ ok: true });
});
