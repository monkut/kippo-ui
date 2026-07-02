import { useCallback, useEffect, useState } from "react";
import { monthlyAssignmentsList } from "~/lib/api/generated/monthly-assignments/monthly-assignments";
import type {
  KippoProject,
  PatchedProjectMonthlyAssignmentRequest,
  ProjectForecastResponse,
  ProjectMonthlyAssignment,
  ProjectMonthlyAssignmentRequest,
} from "~/lib/api/generated/models";
import { projectsForecastRetrieve, projectsRetrieve } from "~/lib/api/generated/projects/projects";
import { readList } from "~/lib/api/read-list";
import { useProjectAssignmentMutations } from "./useProjectAssignmentMutations";

export type UseProjectAssignmentsState = {
  isLoading: boolean;
  isSaving: boolean;
  error: string;
  setError: (err: string) => void;
  project: KippoProject | null;
  forecast: ProjectForecastResponse | null;
  forecastError: string;
  assignments: ProjectMonthlyAssignment[];
  refresh: () => Promise<void>;
  createAssignment: (payload: ProjectMonthlyAssignmentRequest) => Promise<boolean>;
  updateAssignment: (id: number, patch: PatchedProjectMonthlyAssignmentRequest) => Promise<boolean>;
  deleteAssignment: (id: number) => Promise<boolean>;
  bulkCreateAssignments: (payloads: ProjectMonthlyAssignmentRequest[]) => Promise<boolean>;
};

const FORECAST_400_MESSAGE =
  "プロジェクトの開始日が設定されていないため、完了予測を計算できません。";

type ForecastResponseOr400 =
  | { status: 200; data: ProjectForecastResponse }
  | { status: 400; data: undefined }
  | { status: number; data?: unknown };

async function fetchForecastTolerating400(projectId: string): Promise<ForecastResponseOr400> {
  // Forecast endpoint returns 400 when project.start_date is null. Surface that as a
  // forecastError on the hook return without failing the whole view — the assignments
  // table is still useful even when the forecast can't compute.
  try {
    return await projectsForecastRetrieve(projectId);
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 400) return { status: 400, data: undefined };
    throw err;
  }
}

type FetchData = {
  project: KippoProject | null;
  assignments: ProjectMonthlyAssignment[];
  forecast: ProjectForecastResponse | null;
  forecastError: string;
};

async function fetchAllForProject(projectId: string): Promise<FetchData> {
  const [projectRes, assignmentsRes, forecastRes] = await Promise.all([
    projectsRetrieve(projectId),
    monthlyAssignmentsList({ project: projectId }),
    fetchForecastTolerating400(projectId),
  ]);
  return {
    project: projectRes.status === 200 ? projectRes.data : null,
    assignments: readList<ProjectMonthlyAssignment>(assignmentsRes.data),
    forecast: forecastRes.status === 200 ? (forecastRes.data as ProjectForecastResponse) : null,
    forecastError: forecastRes.status === 400 ? FORECAST_400_MESSAGE : "",
  };
}

export function useProjectAssignments(projectId: string | undefined): UseProjectAssignmentsState {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<FetchData>({
    project: null,
    assignments: [],
    forecast: null,
    forecastError: "",
  });

  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError("");
    try {
      setData(await fetchAllForProject(projectId));
    } catch {
      setError("データの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const mutations = useProjectAssignmentMutations(fetchAll, setError);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    isLoading,
    isSaving: mutations.isSaving,
    error,
    setError,
    project: data.project,
    forecast: data.forecast,
    forecastError: data.forecastError,
    assignments: data.assignments,
    refresh: fetchAll,
    createAssignment: mutations.createAssignment,
    updateAssignment: mutations.updateAssignment,
    deleteAssignment: mutations.deleteAssignment,
    bulkCreateAssignments: mutations.bulkCreateAssignments,
  };
}
