import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createRoot } from "react-dom/client";
import { ProjectStatusMeter } from "../app/components/project-status";
import type { ProjectProgressStatusInline } from "../app/lib/api/generated";

// 稼働状況 meter colours. `level` comes from the API (kippo: neutral = no comparison, success = at
// or under expected, warning = over expected, danger = over by more than the exceeding threshold);
// the hours, the ±% and the bar fill all take their colour from it.

const tick = () => new Promise((r) => setTimeout(r, 20));

function status(overrides: Partial<ProjectProgressStatusInline>): ProjectProgressStatusInline {
  return {
    current_effort_hours: 40,
    expected_effort_hours: 60,
    allocated_effort_hours: 80,
    is_estimated_allocated_effort_hours: false,
    difference_percentage: null,
    level: "neutral",
    ...overrides,
  };
}

describe("ProjectStatusMeter colours", () => {
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

  async function renderMeter(value: ProjectProgressStatusInline | null) {
    root.render(<ProjectStatusMeter status={value} />);
    await tick();
    return {
      hours: container.querySelector<HTMLElement>(".text-2xl"),
      difference: container.querySelector<HTMLElement>(".text-sm"),
      bar: container.querySelector<HTMLElement>(".h-full"),
    };
  }

  const CASES = [
    {
      level: "neutral",
      difference_percentage: null,
      text: "text-gray-600",
      bar: "bg-gray-400",
      label: null,
    },
    {
      level: "success",
      difference_percentage: -33.3,
      text: "text-green-600",
      bar: "bg-green-500",
      label: "-33%",
    },
    {
      level: "success",
      difference_percentage: 0,
      text: "text-green-600",
      bar: "bg-green-500",
      label: "0%",
    },
    {
      level: "warning",
      difference_percentage: 10,
      text: "text-yellow-600",
      bar: "bg-yellow-500",
      label: "+10%",
    },
    {
      level: "danger",
      difference_percentage: 20,
      text: "text-red-600",
      bar: "bg-red-500",
      label: "+20%",
    },
  ] as const;

  for (const c of CASES) {
    test(`${c.level} (${c.difference_percentage ?? "no comparison"}): ${c.text} / ${c.bar}`, async () => {
      const { hours, difference, bar } = await renderMeter(
        status({ level: c.level, difference_percentage: c.difference_percentage }),
      );
      expect(hours?.textContent).toBe("40h");
      expect(hours?.className).toBe(`text-2xl font-semibold ${c.text}`);
      expect(bar?.className).toBe(`h-full ${c.bar} transition-all duration-300`);
      expect(bar?.style.width).toBe("50%");
      if (c.label === null) {
        expect(difference).toBeNull();
      } else {
        expect(difference?.textContent).toBe(c.label);
        expect(difference?.className).toBe(`text-sm ${c.text}`);
      }
    });
  }

  // The threshold lives in the backend only: the UI does not re-derive the level.
  test("the colour follows level, not a threshold applied to difference_percentage", async () => {
    const { hours, difference, bar } = await renderMeter(
      status({ level: "danger", difference_percentage: 5 }),
    );
    expect(hours?.className).toBe("text-2xl font-semibold text-red-600");
    expect(difference?.className).toBe("text-sm text-red-600");
    expect(difference?.textContent).toBe("+5%");
    expect(bar?.className).toBe("h-full bg-red-500 transition-all duration-300");
  });

  test("without expected or allocated hours only the logged hours show, in grey", async () => {
    const { hours, bar } = await renderMeter(
      status({ expected_effort_hours: null, level: "danger", difference_percentage: 20 }),
    );
    expect(hours?.className).toBe("text-2xl font-semibold text-gray-600");
    expect(bar).toBeNull();
  });

  test("no status renders a dash", async () => {
    await renderMeter(null);
    expect(container.textContent).toBe("-");
  });
});
