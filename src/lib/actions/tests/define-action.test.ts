import { beforeEach, describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { OrderRepoError } from "@/domain/order";
import { OwnerRequiredError, type ManagerSession } from "@/domain/auth";
import { defineAction } from "../define-action";
import { ActionError } from "../types";

const { requireAuthenticatedAction, requireOwnerAction } = vi.hoisted(() => ({
  requireAuthenticatedAction: vi.fn(),
  requireOwnerAction: vi.fn(),
}));
vi.mock("@/features/auth", () => ({
  requireAuthenticatedAction,
  requireOwnerAction,
}));

const ctx = { businessId: "b-1", session: { user: { id: "u-1" } } as unknown as ManagerSession };
const schema = z.object({ name: z.string().min(1, "Name is required"), qty: z.number() });

describe("defineAction", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedAction.mockResolvedValue(ctx);
    requireOwnerAction.mockResolvedValue(ctx);
  });

  it("returns ok with the parsed input and the auth context", async () => {
    const handler = vi.fn(async ({ input, businessId }) => `${businessId}:${input.name}`);
    const action = defineAction("t", { input: schema }, handler);
    expect(await action({ name: "a", qty: 1 })).toEqual({ ok: true, data: "b-1:a" });
  });

  it("works without input and for public actions (no auth check)", async () => {
    const action = defineAction("t", { auth: "public" }, async () => 7);
    expect(await action()).toEqual({ ok: true, data: 7 });
    expect(requireAuthenticatedAction).not.toHaveBeenCalled();
  });

  it("returns VALIDATION with field errors and does not run the handler", async () => {
    const handler = vi.fn();
    const res = await defineAction("t", { input: schema }, handler)({ name: "", qty: "x" });
    expect(res).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { name: ["Name is required"], qty: [expect.any(String)] },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("propagates the login redirect from the auth check and skips the handler", async () => {
    requireAuthenticatedAction.mockImplementation(async () => redirect("/manage/login"));
    const handler = vi.fn();
    await expect(defineAction("t", {}, handler)()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN for a non-owner on an owner-only action", async () => {
    requireOwnerAction.mockRejectedValue(new OwnerRequiredError());
    const handler = vi.fn();
    const res = await defineAction("t", { auth: "owner" }, handler)();
    expect(res).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("maps ActionError and OwnerRequiredError thrown by the handler", async () => {
    const refuse = defineAction("t", {}, async () => {
      throw new ActionError("CONFLICT", "Already exists", { reason: "DUP" });
    });
    expect(await refuse()).toMatchObject({
      ok: false,
      code: "CONFLICT",
      message: "Already exists",
      reason: "DUP",
    });
    const owner = defineAction("t", {}, async () => {
      throw new OwnerRequiredError();
    });
    expect(await owner()).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it.each([
    ["INVALID_INPUT", "VALIDATION"],
    ["ORDER_NOT_FOUND", "NOT_FOUND"],
    ["PRODUCT_NOT_FOUND", "NOT_FOUND"],
    ["UNAUTHORIZED", "FORBIDDEN"],
    ["RATE_LIMITED", "RATE_LIMITED"],
    ["ORDER_STATE_CONFLICT", "CONFLICT"],
    ["STOCK_ERROR", "CONFLICT"],
  ])("maps OrderRepoError %s to %s keeping its vetted message", async (repoCode, code) => {
    const action = defineAction("t", {}, async () => {
      throw new OrderRepoError("Vetted text", repoCode, { p1: "line" });
    });
    expect(await action()).toMatchObject({
      ok: false,
      code,
      message: "Vetted text",
      reason: repoCode,
      lineErrors: { p1: "line" },
    });
  });

  it("hides the text of an internal OrderRepoError", async () => {
    const action = defineAction("t", {}, async () => {
      throw new OrderRepoError("secret detail", "INTERNAL_ERROR");
    });
    const res = await action();
    expect(res).toMatchObject({ ok: false, code: "INTERNAL" });
    expect(JSON.stringify(res)).not.toContain("secret");
  });

  it("returns INTERNAL without raw text for an unknown error and logs the action name", async () => {
    const action = defineAction("doThing", {}, async () => {
      throw new Error('duplicate key value violates unique constraint "x" (phone)=(0612)');
    });
    const res = await action();
    expect(res).toMatchObject({ ok: false, code: "INTERNAL" });
    expect(JSON.stringify(res)).not.toMatch(/duplicate|0612/);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("doThing"), "Error");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("0612");
  });

  it("rethrows redirect() and notFound() from the handler instead of swallowing them", async () => {
    await expect(defineAction("t", {}, async () => redirect("/somewhere"))()).rejects.toMatchObject(
      { digest: expect.stringContaining("NEXT_REDIRECT") },
    );
    await expect(defineAction("t", {}, async () => notFound())()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
