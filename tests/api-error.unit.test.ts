import { describe, expect, test } from "vitest";
import { ApiError, apiErrorMessage, throwOnError } from "../app/lib/api/api-error";

describe("throwOnError", () => {
  test("returns the response unchanged for 2xx", () => {
    const ok = { status: 200, data: { id: "x" } };
    expect(throwOnError(ok)).toBe(ok);
  });

  test("throws an ApiError carrying status + data for non-2xx", () => {
    const bad = { status: 400, data: { phase: ["nope"] } };
    try {
      throwOnError(bad);
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).data).toEqual({ phase: ["nope"] });
    }
  });
});

describe("apiErrorMessage", () => {
  test("uses DRF detail when present", () => {
    expect(apiErrorMessage(new ApiError(403, { detail: "権限がありません" }))).toBe(
      "権限がありません",
    );
  });

  test("joins field errors as 'field: message'", () => {
    const msg = apiErrorMessage(
      new ApiError(400, { phase: ["A contract must exist."], start_date: ["Invalid."] }),
    );
    expect(msg).toBe("phase: A contract must exist. / start_date: Invalid.");
  });

  test("shows non_field_errors without a field prefix", () => {
    expect(apiErrorMessage(new ApiError(400, { non_field_errors: ["Bad combo."] }))).toBe(
      "Bad combo.",
    );
  });

  test("returns null for a non-ApiError throw so the caller can fall back", () => {
    expect(apiErrorMessage(new Error("network"))).toBeNull();
    expect(apiErrorMessage(undefined)).toBeNull();
  });
});
