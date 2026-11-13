import { describe, expect, it } from "vitest";
import { ALPHABET, CODE_LEN, formatCode, normalizeCode, randomCode } from "@/lib/pairing-code";
import { parseSms } from "@/lib/sms/parser";
import { smsFingerprint } from "@/lib/sms/fingerprint";

describe("pairing codes", () => {
  it("are 8 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const c = randomCode();
      expect(c).toHaveLength(CODE_LEN);
      expect([...c].every((ch) => ALPHABET.includes(ch))).toBe(true);
      expect(c).not.toMatch(/[01OILU]/);
    }
  });
  it("don't repeat in practice", () => {
    const seen = new Set(Array.from({ length: 2000 }, randomCode));
    expect(seen.size).toBe(2000);
  });
  it("accept the forms people and the Shortcut send", () => {
    expect(normalizeCode("abcd-2345")).toBe("ABCD2345");
    expect(normalizeCode(" ABCD 2345 ")).toBe("ABCD2345");
    expect(normalizeCode("mizan-pair:https://mizan.example.com#ABCD2345")).toBe("ABCD2345");
    expect(normalizeCode("https://mizan.example.com/pair#ABCD2345")).toBe("ABCD2345");
    expect(formatCode("ABCD2345")).toBe("ABCD-2345");
  });
  it("reject anything else", () => {
    for (const bad of ["", "ABCD234", "ABCD23456", "ABCD-234O", "ABCD-2341", "'; DROP TABLE x;--", "mzd_abc"]) {
      expect(normalizeCode(bad)).toBeNull();
    }
  });
});

describe("sensitive messages are never imported", () => {
  const receivedAt = new Date("2026-10-15T10:00:00+05:00");
  const read = (text: string) => parseSms({ sender: "MCB", text, receivedAt });
  it.each([
    "Your OTP is 482913. Do not share it with anyone.",
    "482913 is your one-time password for MCB Live.",
    "Your verification code: 552190",
    "Use security code 7731 to approve your login",
    "Your login code is 99812",
    "Activation code for your debit card is 4410",
    "MCB: your code is 1234 valid for 5 minutes",
  ])("%s", (text) => {
    expect(read(text).status).toBe("ignored");
  });
  it("still imports a normal debit alert", () => {
    expect(read("PKR 500.00 debited from A/C ****1234 at KFC on 15-Oct-2026").status).toBe("parsed");
  });
});

describe("duplicate fingerprints", () => {
  const at = new Date("2026-10-15T10:00:00+05:00");
  const later = new Date("2026-10-15T10:20:00+05:00");
  const text = "PKR 500.00 debited from A/C ****1234 at KFC on 15-Oct-2026 Ref FT123";
  it("match a re-sent alert with a bank reference even at a different time", () => {
    expect(smsFingerprint("k:user1", "MCB", text, at, true)).toBe(smsFingerprint("k:user1", "MCB", text, later, true));
  });
  it("differ between users, so one account's alerts never collide with another's", () => {
    expect(smsFingerprint("k:user1", "MCB", text, at, true)).not.toBe(smsFingerprint("k:user2", "MCB", text, at, true));
  });
  it("keep two identical alerts without a reference apart when they arrive at different times", () => {
    const plain = "PKR 500.00 debited at KFC";
    expect(smsFingerprint("k", "MCB", plain, at, false)).not.toBe(smsFingerprint("k", "MCB", plain, later, false));
  });
});
