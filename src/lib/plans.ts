import "server-only";
import { requireUser, type Authed } from "./auth";
import { HttpError } from "./http";
import type { User } from "./users";

/**
 * What Pro adds. Free keeps everything you do by hand: adding transactions, the dashboard, transactions,
 * calendar, recipients, balance and CSV export.
 */
export const PRO_FEATURES = {
  sms: "Automatic SMS import and the Review inbox",
  multiBank: "More than one bank",
  push: "Push notifications",
  backup: "Nightly Google Drive backups",
  monthly: "Monthly payments checklist",
  spending: "Spending limits and the spending check",
  setAsides: "Set-asides",
  zakat: "Zakat calculator",
} as const;
export type ProFeature = keyof typeof PRO_FEATURES;

export const FREE_BANKS = 1;

export function isPro(user: Pick<User, "plan">): boolean {
  return user.plan === "pro";
}

/** 402 with a hint the app turns into an upgrade prompt. */
export function proRequired(feature: ProFeature): HttpError {
  return new HttpError(402, `${PRO_FEATURES[feature]} is part of Mizan Pro.`, { upgrade: true, feature });
}

export function assertPro(user: Pick<User, "plan">, feature: ProFeature) {
  if (!isPro(user)) throw proRequired(feature);
}

/** requireUser, and the account must be on Pro. */
export async function requirePro(req: Request, feature: ProFeature): Promise<Authed> {
  const a = await requireUser(req);
  assertPro(a.user, feature);
  return a;
}


