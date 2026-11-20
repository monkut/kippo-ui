import { describe, expect, test } from "vitest";
import {
  buildParticipantRows,
  buildUserRows,
  sumPercentages,
} from "../app/components/project-assignments/edit-context";
import type { ProjectMonthlyAssignment, ProjectParticipant } from "../app/lib/api/generated/models";

const row = (over: Partial<ProjectMonthlyAssignment>) =>
  ({
    id: 1,
    project: "p1",
    project_name: "P1",
    user: "u1",
    user_username: "alice",
    user_display_name: "Alice",
    month: "2026-11-01",
    percentage: 40,
    ...over,
  }) as ProjectMonthlyAssignment;

const participant = (over: Partial<ProjectParticipant>) =>
  ({
    id: 1,
    project: "p1",
    user: "u1",
    user_username: "alice",
    user_display_name: "Alice",
    percentage: 40,
    role: "developer",
    ...over,
  }) as ProjectParticipant;

describe("buildParticipantRows", () => {
  const editing = row({});

  test("joins participants with the month's rows, the edited user first with the form value", () => {
    const rows = buildParticipantRows(
      [
        participant({ id: 2, user: "u2", user_display_name: "Bob", percentage: 30 }),
        participant({}),
        participant({ id: 3, user: "u3", user_display_name: "Carol", role: "" as never }),
      ],
      [editing, row({ id: 2, user: "u2", user_display_name: "Bob", percentage: 25 })],
      editing,
      55,
    );
    expect(rows.map((r) => [r.name, r.defaultPercentage, r.monthPercentage, r.isEditing])).toEqual([
      ["Alice", 40, 55, true],
      ["Bob", 30, 25, false],
      ["Carol", 40, null, false],
    ]);
  });

  test("keeps month rows without a participant (pre-kippo#75 data)", () => {
    const rows = buildParticipantRows(
      [participant({})],
      [editing, row({ id: 9, user: "u9", user_display_name: "Legacy", percentage: 10 })],
      editing,
      40,
    );
    expect(rows.map((r) => [r.name, r.defaultPercentage, r.monthPercentage])).toEqual([
      ["Alice", 40, 40],
      ["Legacy", null, 10],
    ]);
  });
});

describe("buildUserRows", () => {
  test("puts the edited project first with the form value, others by percentage", () => {
    const editing = row({});
    const rows = buildUserRows(
      [
        row({ id: 5, project: "p5", project_name: "Small", percentage: 10 }),
        editing,
        row({ id: 6, project: "p6", project_name: "Big", percentage: 60 }),
      ],
      editing,
      35,
    );
    expect(rows.map((r) => [r.projectName, r.percentage, r.isEditing])).toEqual([
      ["P1", 35, true],
      ["Big", 60, false],
      ["Small", 10, false],
    ]);
    expect(sumPercentages(rows)).toBe(105);
  });

  test("shows the edited project even before the month rows load", () => {
    expect(buildUserRows([], row({}), 40)).toEqual([
      { projectId: "p1", projectName: "P1", percentage: 40, isEditing: true },
    ]);
  });
});
