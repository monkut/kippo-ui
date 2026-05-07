import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createRoot } from "react-dom/client";
import { SurveyStatusIcon } from "../app/routes/project-status";
import type { SurveyUserInline } from "../app/lib/api/generated";

// Regression tests for issue #33 — when an effort user is not present in
// survey_users (i.e. <=3% effort, no survey assigned), the row must still
// render an icon instead of going blank.

const completedSurvey: SurveyUserInline = {
  user_id: 1,
  username: "alice",
  display_name: "Alice",
  percentage: 50,
  survey_completed: true,
};

const incompleteSurvey: SurveyUserInline = {
  ...completedSurvey,
  survey_completed: false,
};

const waitForTitle = async (container: HTMLElement, timeout = 1000): Promise<string | null> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const title = container.querySelector("title")?.textContent;
    if (title) return title;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
};

describe("SurveyStatusIcon", () => {
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

  test("renders 'not assigned' icon when surveyUser is undefined", async () => {
    root.render(<SurveyStatusIcon surveyUser={undefined} />);
    expect(await waitForTitle(container)).toBe("アンケート未割り当て");
  });

  test("renders 'completed' icon when survey_completed is true", async () => {
    root.render(<SurveyStatusIcon surveyUser={completedSurvey} />);
    expect(await waitForTitle(container)).toBe("アンケート完了");
  });

  test("renders 'not completed' icon when survey_completed is false", async () => {
    root.render(<SurveyStatusIcon surveyUser={incompleteSurvey} />);
    expect(await waitForTitle(container)).toBe("アンケート未完了");
  });
});
