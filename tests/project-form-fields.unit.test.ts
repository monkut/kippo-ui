import { describe, expect, it } from "vitest";
import { LEAD_SOURCE_OPTIONS, PHASE_OPTIONS } from "~/components/project-form/fields";
import { LeadSourceEnum, PhaseEnum } from "~/lib/api/generated/models";

// LEAD_SOURCE_OPTIONS / PHASE_OPTIONS are hand-maintained Japanese labels for backend choice keys, so
// they drift whenever kippo adds a choice: a key missing here cannot be selected, and editing a project
// that already carries it silently rewrites the value to another option. Pin them to the generated enums
// (which come from the release schema via `pnpm update:api`) so the sync fails loudly instead.
describe("project form choice options", () => {
  it("covers every lead_source the API accepts", () => {
    expect(LEAD_SOURCE_OPTIONS.map((option) => option.value).sort()).toEqual(
      Object.values(LeadSourceEnum).sort(),
    );
  });

  it("covers every phase the API accepts", () => {
    expect(PHASE_OPTIONS.map((option) => option.value).sort()).toEqual(
      Object.values(PhaseEnum).sort(),
    );
  });
});
