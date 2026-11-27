import { describe, expect, test } from "vitest";
import {
  buildProjectPatch,
  EMPTY_PROJECT_EDIT_FORM,
  type ProjectEditForm,
  projectEditFormFromProject,
} from "../app/components/project-form/project-edit-form";
import { buildContractRequest, type ContractForm } from "../app/hooks/useProjectContract";
import type {
  KippoProject,
  KippoProjectOrganizationCategory,
} from "../app/lib/api/generated/models";

const category = (key: string, organization: string | null) =>
  ({ key, label: key, organization }) as unknown as KippoProjectOrganizationCategory;

const form = (overrides: Partial<ProjectEditForm>): ProjectEditForm => ({
  ...EMPTY_PROJECT_EDIT_FORM,
  name: "P",
  ...overrides,
});

describe("projectEditFormFromProject", () => {
  test("maps the record to input values, blanking nulls", () => {
    const loaded = projectEditFormFromProject({
      name: "P",
      phase: "under-contract",
      category: "sunx",
      lead_source: "info",
      project_manager: null,
      allocated_staff_days: 12,
      start_date: "2026-01-01",
      target_date: null,
      enable_cost_report: true,
      parent_project: "pp",
      parent_project_name: "Parent",
    } as unknown as KippoProject);
    expect(loaded).toMatchObject({
      name: "P",
      phase: "under-contract",
      category: "sunx",
      leadSource: "info",
      projectManagerId: "",
      allocatedStaffDays: "12",
      startDate: "2026-01-01",
      targetDate: "",
      enableCostReport: true,
      parentProjectId: "pp",
      parentProjectName: "Parent",
    });
  });

  test("a record without a phase falls back to the default phase", () => {
    expect(projectEditFormFromProject({ name: "P" } as unknown as KippoProject).phase).toBe(
      "proposing-low",
    );
  });
});

describe("buildProjectPatch", () => {
  // kippo#49: the organization's own category rows are the selectable (and writable) ones.
  test("sends the category when it is one of the organization's categories", () => {
    const patch = buildProjectPatch(form({ category: "sunx" }), {
      categories: [category("sunx", "org-1")],
      hasContract: false,
    });
    expect(patch.category).toBe("sunx");
  });

  test("omits a category that is not offered", () => {
    const patch = buildProjectPatch(form({ category: "retired" }), {
      categories: [category("sunx", "org-1")],
      hasContract: false,
    });
    expect(patch.category).toBeUndefined();
    expect("category" in JSON.parse(JSON.stringify(patch))).toBe(false);
  });

  test("omits the dates once a contract owns the period", () => {
    const values = form({ startDate: "2026-01-01", targetDate: "2026-06-30" });
    expect(buildProjectPatch(values, { categories: [], hasContract: false })).toMatchObject({
      start_date: "2026-01-01",
      target_date: "2026-06-30",
    });
    const withContract = buildProjectPatch(values, { categories: [], hasContract: true });
    expect("start_date" in withContract).toBe(false);
    expect("target_date" in withContract).toBe(false);
  });

  test("trims text, nulls blanks and parses 必要工数", () => {
    const patch = buildProjectPatch(
      form({
        name: "  P  ",
        allocatedStaffDays: " 7 ",
        slackChannelName: " ch ",
        projectManagerId: "",
        parentProjectId: "",
      }),
      { categories: [], hasContract: false },
    );
    expect(patch).toMatchObject({
      name: "P",
      allocated_staff_days: 7,
      slack_channel_name: "ch",
      project_manager: null,
      parent_project: null,
      start_date: null,
      target_date: null,
    });
    expect(
      buildProjectPatch(form({ allocatedStaffDays: "" }), { categories: [], hasContract: false })
        .allocated_staff_days,
    ).toBeNull();
  });
});

describe("buildContractRequest", () => {
  const contract = (overrides: Partial<ContractForm>): ContractForm => ({
    billingType: "delivery",
    pricingBasis: "fixed",
    totalAmount: "",
    estimatedMonthly: "",
    startDate: "",
    endDate: "",
    note: "",
    billedToId: "",
    billedToName: null,
    ...overrides,
  });

  test("月額 is sent only for effort + monthly", () => {
    const monthly = contract({
      billingType: "monthly",
      pricingBasis: "effort",
      estimatedMonthly: " 200 ",
    });
    expect(buildContractRequest(monthly).estimated_monthly_amount).toBe("200");
    expect(
      buildContractRequest({ ...monthly, pricingBasis: "fixed" }).estimated_monthly_amount,
    ).toBeNull();
    expect(
      buildContractRequest({ ...monthly, estimatedMonthly: "" }).estimated_monthly_amount,
    ).toBeNull();
  });

  test("blank amount, period and 請求先 are sent as null", () => {
    expect(buildContractRequest(contract({ note: " n " }))).toEqual({
      billing_type: "delivery",
      pricing_basis: "fixed",
      total_amount: null,
      estimated_monthly_amount: null,
      start_date: null,
      end_date: null,
      note: "n",
      billed_to: null,
    });
  });
});
