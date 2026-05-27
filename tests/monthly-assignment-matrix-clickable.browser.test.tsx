import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { MonthlyAssignmentMatrix } from "../app/components/project-assignments/MonthlyAssignmentMatrix";
import type {
  KippoProject,
  OrganizationMemberDetail,
  ProjectMonthlyAssignment,
} from "../app/lib/api/generated/models";

// #22: single-click on a matrix cell opens the right modal. The matrix only
// surfaces the callback — modal wiring is the route's job. These tests verify
// the click contract: filled cell → callback receives the assignment; empty
// cell → callback receives `assignment: null`; past month → no callback at all
// (cells render as <span>, not <button>).

function makeProject(over: Partial<KippoProject> = {}): KippoProject {
  return {
    id: "p-1",
    name: "Project 1",
    start_date: "2026-01-01",
    target_date: "2026-12-31",
    ...over,
  } as unknown as KippoProject;
}

function makeMember(over: Partial<OrganizationMemberDetail>): OrganizationMemberDetail {
  return {
    user_id: "u-1",
    username: "alice",
    display_name: "Alice",
    first_name: "alice",
    last_name: "doe",
    email: "alice@example.com",
    github_login: "alice-gh",
    is_developer: true,
    is_project_manager: false,
    slack_username: "",
    slack_user_id: "",
    slack_image_url: "",
    available_work_days: 20,
    ...over,
  };
}

function makeAssignment(over: Partial<ProjectMonthlyAssignment>): ProjectMonthlyAssignment {
  return {
    id: 1,
    project: "p-1",
    project_name: "Project 1",
    user: "u-1",
    user_username: "alice",
    user_display_name: "Alice",
    user_github_login: "alice-gh",
    user_slack_username: null,
    user_slack_image_url: null,
    month: "2026-05-01",
    percentage: 50,
    is_confirmed: true,
    created_datetime: "2026-05-08T00:00:00Z",
    updated_datetime: "2026-05-08T00:00:00Z",
    ...over,
  };
}

async function waitFor<T>(probe: () => T | null | undefined, timeout = 2000): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = probe();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

function renderMatrix(
  root: ReturnType<typeof createRoot>,
  props: React.ComponentProps<typeof MonthlyAssignmentMatrix>,
) {
  root.render(
    <MemoryRouter>
      <MonthlyAssignmentMatrix {...props} />
    </MemoryRouter>,
  );
}

/** Find the cell <button> for a given user column. Confirmed/unconfirmed both
 * render their percentage as the button's only text node, so locating by text
 * is the most robust strategy. */
function cellButtonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLButtonElement>("td button")).find(
      (b) => b.textContent?.trim() === text,
    ) ?? null
  );
}

describe("MonthlyAssignmentMatrix — #22 click-to-edit/add", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  const project = makeProject();
  const alice = makeMember({ user_id: "u-1", display_name: "Alice" });
  const bob = makeMember({ user_id: "u-2", display_name: "Bob" });
  const aliceAssignment = makeAssignment({ user: "u-1", percentage: 50, is_confirmed: true });

  test("clicking a filled (confirmed) cell calls onCellClick with the source assignment", async () => {
    const onCellClick = vi.fn();
    renderMatrix(root, {
      projects: [project],
      assignments: [aliceAssignment],
      members: [alice, bob],
      editableMonth: true,
      onCellClick,
    });

    const aliceBtn = await waitFor(() => cellButtonByText(container, "50%"));
    expect(aliceBtn).not.toBeNull();
    aliceBtn?.click();

    expect(onCellClick).toHaveBeenCalledTimes(1);
    const args = onCellClick.mock.calls[0][0];
    expect(args.project.id).toBe("p-1");
    expect(args.user.user_id).toBe("u-1");
    expect(args.assignment?.id).toBe(aliceAssignment.id);
    expect(args.assignment?.percentage).toBe(50);
  });

  test("clicking an empty cell calls onCellClick with assignment=null", async () => {
    const onCellClick = vi.fn();
    renderMatrix(root, {
      projects: [project],
      assignments: [aliceAssignment], // only Alice has an assignment
      members: [alice, bob],
      editableMonth: true,
      onCellClick,
    });

    // Bob's column has no assignment → renders as a placeholder button "—".
    const emptyBtn = await waitFor(() => cellButtonByText(container, "—"));
    expect(emptyBtn).not.toBeNull();
    emptyBtn?.click();

    expect(onCellClick).toHaveBeenCalledTimes(1);
    const args = onCellClick.mock.calls[0][0];
    expect(args.project.id).toBe("p-1");
    expect(args.user.user_id).toBe("u-2"); // Bob
    expect(args.assignment).toBeNull();
  });

  test("past-month cells render as <span>, no button, no click", async () => {
    const onCellClick = vi.fn();
    renderMatrix(root, {
      projects: [project],
      assignments: [aliceAssignment],
      members: [alice, bob],
      editableMonth: false,
      onCellClick,
    });

    await waitFor(() => container.querySelector("table"));

    // Filled cell: span (not button).
    const filledCell = Array.from(container.querySelectorAll("td span")).find(
      (s) => s.textContent?.trim() === "50%",
    );
    expect(filledCell).toBeDefined();
    expect(filledCell?.tagName).toBe("SPAN");
    expect(filledCell?.getAttribute("title")).toContain("過去月のためロック");

    // Empty cell: also a span (the static `—`), not a button.
    const emptyCell = Array.from(container.querySelectorAll("td span")).find(
      (s) => s.textContent?.trim() === "—",
    );
    expect(emptyCell).toBeDefined();
    expect(emptyCell?.tagName).toBe("SPAN");

    // No percentage-cell buttons in read-only mode. (Sort buttons live in
    // <thead>; the project-id copy button is in <td> but its text is the
    // truncated id — never a percentage or `—`.)
    const percentageButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("td button"),
    ).filter((b) => {
      const txt = b.textContent?.trim() ?? "";
      return txt === "—" || /%$/.test(txt);
    });
    expect(percentageButtons.length).toBe(0);
    expect(onCellClick).not.toHaveBeenCalled();
  });

  test("editableMonth=true but onCellClick omitted falls back to read-only", async () => {
    renderMatrix(root, {
      projects: [project],
      assignments: [aliceAssignment],
      members: [alice, bob],
      editableMonth: true,
    });

    await waitFor(() => container.querySelector("table"));
    // No handler → no percentage-cell buttons (project-id copy buttons may
    // still exist; filter to cell content).
    const percentageButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("td button"),
    ).filter((b) => {
      const txt = b.textContent?.trim() ?? "";
      return txt === "—" || /%$/.test(txt);
    });
    expect(percentageButtons.length).toBe(0);
  });

  test("clickable cell tooltip omits the locked-month tail", async () => {
    const onCellClick = vi.fn();
    renderMatrix(root, {
      projects: [project],
      assignments: [aliceAssignment],
      members: [alice],
      editableMonth: true,
      onCellClick,
    });

    const aliceBtn = await waitFor(() => cellButtonByText(container, "50%"));
    expect(aliceBtn?.getAttribute("title")).not.toContain("過去月のためロック");
  });
});
