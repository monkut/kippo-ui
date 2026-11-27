import { describe, expect, test } from "vitest";
import { createSubmitLabel } from "../app/components/project-detail/forms/scaffolding";

describe("createSubmitLabel", () => {
  test("shows the entry count only when more than one entry is valid", () => {
    expect(createSubmitLabel(false, 0)).toBe("作成");
    expect(createSubmitLabel(false, 1)).toBe("作成");
    expect(createSubmitLabel(false, 3)).toBe("作成 (3件)");
  });

  test("shows the in-progress label while submitting", () => {
    expect(createSubmitLabel(true, 3)).toBe("作成中...");
  });
});
