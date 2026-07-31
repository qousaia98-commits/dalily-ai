import { describe, expect, it } from "vitest";
import {
  CONTACT_INFO_BLOCKED_ERROR,
  containsContactInfo,
  detectContactInfo,
  normalizeIndicDigits,
} from "@/lib/security/contact-info-guard";

describe("contact-info-guard", () => {
  it("exports a stable error code for domain/UI mapping", () => {
    expect(CONTACT_INFO_BLOCKED_ERROR).toBe("contact_info_blocked");
  });

  describe("emails", () => {
    it.each([
      "reach me at ali@gmail.com please",
      "Contact: provider.name+work@dalily.co",
      "x@y.io",
    ])("blocks %s", (text) => {
      expect(detectContactInfo(text)).toBe("email");
      expect(containsContactInfo(text)).toBe(true);
    });
  });

  describe("Syrian phone numbers", () => {
    it.each([
      "call 0912345678",
      "WhatsApp 0912 345 678",
      "09-12-345-678",
      "09.123.456.78",
      "+963912345678",
      "+963 9 123 456 78",
      "00963912345678",
      "963912345678",
      "رقمي 0912345678",
    ])("blocks %s", (text) => {
      expect(detectContactInfo(text)).toBe("phone");
      expect(containsContactInfo(text)).toBe(true);
    });
  });

  describe("Arabic-Indic digit phones", () => {
    it("normalizes Eastern Arabic digits", () => {
      expect(normalizeIndicDigits("٠٩١٢٣٤٥٦٧٨")).toBe("0912345678");
    });

    it("blocks Arabic-Indic Syrian mobiles", () => {
      expect(detectContactInfo("اتصلي على ٠٩١٢٣٤٥٦٧٨")).toBe("phone");
      expect(detectContactInfo("٠٩١٢ ٣٤٥ ٦٧٨")).toBe("phone");
    });
  });

  describe("false positives that must NOT be blocked", () => {
    it.each([
      "Budget around 150000 SYP",
      "Quote is 150,000 SYP for parts",
      "Building 12, Apt 4 near the market",
      "Need 12 meters of pipe and 4 fittings",
      "Visit on 25/07/2026 around 3pm",
      "Order ref 20260725-0042",
      "Room 0912 is flooded", // only 4 digits after 09 — not a mobile
      "I need about 90 pieces",
      "AC unit model 9000 BTU",
      "The leak is on floor 9 apartment 12",
      "Please fix the sink tomorrow",
      "",
      "   ",
    ])("allows %s", (text) => {
      expect(containsContactInfo(text)).toBe(false);
      expect(detectContactInfo(text)).toBeNull();
    });
  });
});
