import { describe, expect, it } from "vitest";
import { enDictionary, frDictionary } from "@/domain/i18n";
import { ACTION_CODES } from "../types";
import { actionErrorMessage } from "../error-message";

describe("actionErrorMessage", () => {
  it.each(ACTION_CODES)("maps %s to localized copy in English and French", (code) => {
    expect(actionErrorMessage({ code })).toBe(enDictionary.common.actionErrors[code]);
    expect(actionErrorMessage({ code }, "fr")).toBe(frDictionary.common.actionErrors[code]);
    expect(actionErrorMessage({ code }, "fr")).not.toBe(actionErrorMessage({ code }));
  });

  it("prefers copy for a known reason over the code message", () => {
    expect(actionErrorMessage({ code: "CONFLICT", reason: "STOCK_ERROR" })).toBe(
      enDictionary.common.actionReasons.STOCK_ERROR,
    );
    expect(actionErrorMessage({ code: "CONFLICT", reason: "ORDER_STATE_CONFLICT" }, "fr")).toBe(
      frDictionary.common.actionReasons.ORDER_STATE_CONFLICT,
    );
  });

  it("falls back to the code message for an unknown reason", () => {
    expect(actionErrorMessage({ code: "CONFLICT", reason: "SOMETHING_NEW" })).toBe(
      enDictionary.common.actionErrors.CONFLICT,
    );
  });
});
