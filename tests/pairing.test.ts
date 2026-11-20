import { describe, expect, it } from "vitest";
import { ALPHABET, CODE_LEN, formatCode, normalizeCode, randomCode } from "@/lib/pairing-code";
import { importFinished, smsInput } from "@/lib/validation";
import { pairPayload, shortcutRunUrl } from "@/lib/shortcut-link";
import { forwarderTemplate } from "@/lib/android-forwarder";

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

describe("import run ids from the Shortcut", () => {
  const id = "4180667f-c0c9-4ab2-822f-7a5627622451";
  const alert = { sender: "MYBANK", text: "PKR 1.00 debited", receivedAt: "2026-11-13T18:35:00+05:00" };
  it("accept the Shortcut's input as it arrives, or the bare id", () => {
    expect(smsInput.parse({ ...alert, importRun: `mizan-import:${id}` }).importRun).toBe(id);
    expect(smsInput.parse({ ...alert, importRun: id }).importRun).toBe(id);
    expect(importFinished.parse({ importRun: `mizan-import:${id}`, finished: true }).importRun).toBe(id);
  });
  it("reject anything else", () => {
    expect(smsInput.safeParse({ ...alert, importRun: "mizan-import:nope" }).success).toBe(false);
    expect(importFinished.safeParse({ importRun: id, finished: "true" }).success).toBe(false);
  });
});

describe("links that open the Shortcut", () => {
  it("use the x-callback-url form and carry the pairing link as text", () => {
    const url = shortcutRunUrl("Mizan", pairPayload("https://mizan.example.com", "ABCD2345"));
    expect(url).toBe("shortcuts://x-callback-url/run-shortcut?name=Mizan&input=text&text=https%3A%2F%2Fmizan.example.com%2Fapi%2Fdevices%2Fpair%3Fcode%3DABCD2345");
  });
  it("encode a Shortcut name with spaces", () => {
    expect(shortcutRunUrl("Expense Manager", "mizan-import:x")).toContain("name=Expense%20Manager&input=text&text=mizan-import%3Ax");
  });
});

describe("alerts from Android forwarder apps", () => {
  const base = { sender: "MYBANK", text: "PKR 1.00 debited" };
  it("take Unix time in milliseconds or seconds, as a number or text", () => {
    expect(smsInput.parse({ ...base, receivedAt: 1768556698000 }).receivedAt).toBe("2026-01-16T09:44:58.000Z");
    expect(smsInput.parse({ ...base, receivedAt: "1768556698000" }).receivedAt).toBe("2026-01-16T09:44:58.000Z");
    expect(smsInput.parse({ ...base, receivedAt: 1768556698 }).receivedAt).toBe("2026-01-16T09:44:58.000Z");
  });
  it("may leave receivedAt out", () => {
    expect(smsInput.parse(base).receivedAt).toBeUndefined();
  });
  it("still take the iPhone's ISO dates as they are", () => {
    expect(smsInput.parse({ ...base, receivedAt: "2026-11-13T18:35:00+05:00" }).receivedAt).toBe("2026-11-13T18:35:00+05:00");
  });
  it("reject anything else", () => {
    for (const bad of ["yesterday", "2026-11-13 18:35", 12345, "123456789012345", 1.5e9 + 0.5]) {
      expect(smsInput.safeParse({ ...base, receivedAt: bad }).success).toBe(false);
    }
  });
  it("fill the template with the phone's key", () => {
    const t = forwarderTemplate("mzd_" + "a".repeat(43));
    expect(t).toContain('"receivedAt":%receivedStamp%');
    // Once the app fills in the placeholders, it's an alert Mizan accepts.
    const filled = JSON.parse(t.replace("%from%", "HBL").replace("%text%", "PKR 5.00 debited").replace("%receivedStamp%", "1768556698000"));
    const { key, ...rest } = filled;
    expect(key).toMatch(/^mzd_/);
    expect(smsInput.safeParse(rest).success).toBe(true);
  });
});
