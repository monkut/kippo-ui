import type {
  ProjectBusinessRequirementCategory,
  ProjectProblemDefinition,
} from "~/lib/api/generated/models";

/** Per-section display state of the project detail page (persisted in the URL by the route). */
export type SectionDisplay = {
  expanded: boolean;
  compact: boolean;
  /** Tailwind font-size class for titles / body text (the 文字サイズ selection). */
  titleSize: string;
  bodySize: string;
  onToggleExpanded: () => void;
  onToggleCompact: () => void;
};

export function getAssumptionCategoryColor(category: string | undefined): string {
  if (category?.toLowerCase().includes("constraint")) {
    return "bg-orange-100 text-orange-800";
  }
  return "bg-blue-100 text-blue-800";
}

const CATEGORY_COLORS = [
  "bg-green-100 text-green-800",
  "bg-purple-100 text-purple-800",
  "bg-pink-100 text-pink-800",
  "bg-cyan-100 text-cyan-800",
  "bg-yellow-100 text-yellow-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
  "bg-indigo-100 text-indigo-800",
];

export function getBusinessReqCategoryColor(categoryId: number): string {
  return CATEGORY_COLORS[categoryId % CATEGORY_COLORS.length];
}

// Helper to get business requirement category name from category ID
export function getBusinessReqCategoryName(
  categoryId: number,
  categories: ProjectBusinessRequirementCategory[],
): string {
  const category = categories.find((c) => c.id === categoryId);
  return category?.name || "-";
}

// Helper to get problem display IDs from problem IDs
export function getProblemDisplayIds(
  problemIds: number[] | undefined,
  problems: ProjectProblemDefinition[],
): string {
  if (!problemIds || problemIds.length === 0) return "-";
  return problemIds
    .map((id) => problems.find((p) => p.id === id)?.display_id || `#${id}`)
    .join(", ");
}

/** Create / edit form state of one section: at most one of the two forms is open. */
export type SectionFormState<T> = {
  showForm: boolean;
  /** The row being edited inline, or null. */
  editing: T | null;
  openForm: () => void;
  closeForm: () => void;
  startEditing: (item: T) => void;
  stopEditing: () => void;
};
