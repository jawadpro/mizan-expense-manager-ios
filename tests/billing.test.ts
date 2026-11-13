import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ q: vi.fn() }));
const { verifyPaddleSignature } = await import("@/lib/billing");

const secret = "pdl_ntfset_test";
const body = '{"event_type":"subscription.created"}';
const now = 1_800_000_000_000;
const ts = String(now / 1000);
const sign = (s: string, t = ts, b = body) => crypto.createHmac("sha256", s).update(`${t}:${b}`).digest("hex");

describe("verifyPaddleSignature", () => {
  it("accepts a correct, recent signature", () => {
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${sign(secret)}`, secret, now)).toBe(true);
  });
  it("accepts when any of several h1 values matches (secret rotation)", () => {
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${sign("old")};h1=${sign(secret)}`, secret, now)).toBe(true);
  });
  it("rejects the wrong secret, a changed body, or a missing header", () => {
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${sign("other")}`, secret, now)).toBe(false);
    expect(verifyPaddleSignature(body + " ", `ts=${ts};h1=${sign(secret)}`, secret, now)).toBe(false);
    expect(verifyPaddleSignature(body, null, secret, now)).toBe(false);
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${sign(secret)}`, "", now)).toBe(false);
  });
  it("rejects a signature older than five minutes", () => {
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${sign(secret)}`, secret, now + 301_000)).toBe(false);
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${sign(secret)}`, secret, now + 299_000)).toBe(true);
  });
  it("rejects junk", () => {
    expect(verifyPaddleSignature(body, "ts=abc;h1=zz", secret, now)).toBe(false);
    expect(verifyPaddleSignature(body, `ts=${ts}`, secret, now)).toBe(false);
  });
});
