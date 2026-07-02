import type {
  ProjectAssumption,
  ProjectBusinessRequirement,
  ProjectTechnicalRequirement,
} from "~/lib/api/generated/models";

// Assumption category type for enum-based categories from API
export type AssumptionCategoryChoice = {
  value: string;
  label: string;
};

export type ProblemType = {
  id: number;
  display_id: string;
  title: string;
  details?: string;
};

// Local types matching API models - using API types directly where possible
export type AssumptionType = ProjectAssumption;

export type BusinessRequirementType = ProjectBusinessRequirement & {
  category_name?: string;
  problems_data?: Array<{ id: number; display_id: string; title: string }>;
};

export type TechnicalRequirementType = ProjectTechnicalRequirement;

export type CommentData = {
  id: number;
  comment: string;
  created_by_name: string;
  created_datetime: string;
  is_resolved?: boolean;
  replies?: CommentData[];
};
