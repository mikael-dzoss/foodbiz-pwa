import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatMoney,
  formatPhoneNumber,
  formatRelativeTime,
  formatTime,
} from "../formatting";

describe("Formatting Utilities (#32)", () => {
  describe("formatMoney", () => {
    it("formats cents in EUR for English (EN)", () => {
      expect(formatMoney(1250, "en")).toBe("€12.50");
      expect(formatMoney(0, "en")).toBe("€0.00");
      expect(formatMoney(50, "en")).toBe("€0.50");
      expect(formatMoney(100000, "en")).toBe("€1,000.00");
    });

    it("formats cents in EUR for French (FR)", () => {
      // Non-breaking space U+00A0 or narrow no-break space U+202F depending on Intl runtime
      const fr1250 = formatMoney(1250, "fr").replace(/\s/g, " ");
      expect(fr1250).toBe("12,50 €");

      const fr0 = formatMoney(0, "fr").replace(/\s/g, " ");
      expect(fr0).toBe("0,00 €");
    });

    it("defaults to English when locale is omitted", () => {
      expect(formatMoney(2500)).toBe("€25.00");
    });
  });

  describe("formatDate and formatTime", () => {
    const fixedDate = new Date("2026-10-09T14:30:00Z");

    it("formats dates in short, medium, and long styles", () => {
      expect(formatDate(fixedDate, "en", "short")).toBe("09/10/2026");
      expect(formatDate(fixedDate, "en", "medium")).toContain("2026");
      expect(formatDate(fixedDate, "en", "long")).toContain("October");

      expect(formatDate(fixedDate, "fr", "short")).toBe("09/10/2026");
      expect(formatDate(fixedDate, "fr", "long").toLowerCase()).toContain("octobre");
    });

    it("formats time as HH:mm 24-hour", () => {
      const timeStr = formatTime(fixedDate, "en");
      expect(timeStr).toMatch(/^\d{2}:\d{2}$/);
    });

    it("accepts string and timestamp inputs", () => {
      expect(formatDate("2026-10-09T14:30:00Z", "en", "short")).toBe("09/10/2026");
      expect(formatDate(fixedDate.getTime(), "en", "short")).toBe("09/10/2026");
    });
  });

  describe("formatRelativeTime", () => {
    const now = new Date("2026-10-09T12:00:00Z");

    it("formats relative seconds and minutes in English and French", () => {
      const fiveMinutesAgo = new Date("2026-10-09T11:55:00Z");
      expect(formatRelativeTime(fiveMinutesAgo, now, "en")).toBe("5 minutes ago");
      expect(formatRelativeTime(fiveMinutesAgo, now, "fr")).toBe("il y a 5 minutes");

      const inTenMinutes = new Date("2026-10-09T12:10:00Z");
      expect(formatRelativeTime(inTenMinutes, now, "en")).toBe("in 10 minutes");
      expect(formatRelativeTime(inTenMinutes, now, "fr")).toBe("dans 10 minutes");
    });

    it("formats relative hours, days, months, and years", () => {
      const twoHoursAgo = new Date("2026-10-09T10:00:00Z");
      expect(formatRelativeTime(twoHoursAgo, now, "en")).toBe("2 hours ago");

      const yesterday = new Date("2026-10-08T12:00:00Z");
      expect(formatRelativeTime(yesterday, now, "en")).toBe("yesterday");

      const twoMonthsAgo = new Date("2026-08-09T12:00:00Z");
      expect(formatRelativeTime(twoMonthsAgo, now, "en")).toBe("2 months ago");

      const lastYear = new Date("2025-10-09T12:00:00Z");
      expect(formatRelativeTime(lastYear, now, "en")).toBe("last year");
    });

    it("formats relative seconds when less than a minute", () => {
      const tenSecsAgo = new Date("2026-10-09T11:59:50Z");
      expect(formatRelativeTime(tenSecsAgo, now, "en")).toBe("10 seconds ago");
    });
  });

  describe("formatPhoneNumber", () => {
    it("formats French numbers in international and national styles", () => {
      expect(formatPhoneNumber("+33612345678", "international")).toBe("+33 6 12 34 56 78");
      expect(formatPhoneNumber("+33612345678", "national")).toBe("06 12 34 56 78");
      expect(formatPhoneNumber("06 12 34 56 78", "international")).toBe("+33 6 12 34 56 78");
      expect(formatPhoneNumber("0612345678", "national")).toBe("06 12 34 56 78");
    });

    it("formats US numbers in international and national styles", () => {
      expect(formatPhoneNumber("+14155552671", "international")).toBe("+1 (415) 555-2671");
      expect(formatPhoneNumber("+14155552671", "national")).toBe("(415) 555-2671");
    });

    it("formats UK numbers in international and national styles", () => {
      expect(formatPhoneNumber("+447911123456", "international")).toBe("+44 7911 123456");
      expect(formatPhoneNumber("+447911123456", "national")).toBe("07911 123456");
    });

    it("handles invalid or non-standard inputs gracefully", () => {
      expect(formatPhoneNumber("")).toBe("");
      expect(formatPhoneNumber("not-a-number")).toBe("not-a-number");
    });
  });
});
