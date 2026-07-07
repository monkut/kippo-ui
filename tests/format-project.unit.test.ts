import { describe, expect, test } from "vitest";
import { formatProjectWithCustomer } from "~/lib/format-project";

describe("lib/format-project", () => {
  test("joins customer and project name with the middle-dot separator", () => {
    expect(formatProjectWithCustomer("プロジェクトA", "顧客X")).toBe("顧客X ・ プロジェクトA");
  });

  test("returns the project name alone when there is no customer", () => {
    expect(formatProjectWithCustomer("プロジェクトA")).toBe("プロジェクトA");
    expect(formatProjectWithCustomer("プロジェクトA", null)).toBe("プロジェクトA");
    expect(formatProjectWithCustomer("プロジェクトA", "")).toBe("プロジェクトA");
  });
});
