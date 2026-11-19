import { useCallback, useEffect, useRef, useState } from "react";
import { monthlyAssignmentsList } from "~/lib/api/generated/monthly-assignments/monthly-assignments";
import type {
  KippoProject,
  PatchedProjectMonthlyAssignmentRequest,
  ProjectForecastResponse,
  ProjectMonthlyAssignment,
  ProjectParticipant,
} from "~/lib/api/generated/models";
import {
  projectsForecastRetrieve,
  projectsParticipantsList,
  projectsRetrieve,
} from "~/lib/api/generated/projects/projects";
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
  participants: ProjectParticipant[];
  refresh: () => Promise<void>;
  updateAssignment: (id: number, patch: PatchedProjectMonthlyAssignmentRequest) => Promise<boolean>;
  deleteAssignment: (id: number) => Promise<boolean>;
  addParticipant: ReturnType<typeof useProjectAssignmentMutations>["addParticipant"];
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
  participants: ProjectParticipant[];
  forecast: ProjectForecastResponse | null;
  forecastError: string;
};

async function fetchAllForProject(projectId: string, month: string): Promise<FetchData> {
  // `month` is required: without it the list endpoint defaults to the current month (JST),
  // so every other month would render empty (kiconiaworks/kippo#68).
  const [projectRes, assignmentsRes, participantsRes, forecastRes] = await Promise.all([
    projectsRetrieve(projectId),
    monthlyAssignmentsList({ project: projectId, month }),
    projectsParticipantsList(projectId),
    fetchForecastTolerating400(projectId),
  ]);
  return {
    project: projectRes.status === 200 ? projectRes.data : null,
    assignments: readList<ProjectMonthlyAssignment>(assignmentsRes.data),
    participants: readList<ProjectParticipant>(participantsRes.data),
    forecast: forecastRes.status === 200 ? (forecastRes.data as ProjectForecastResponse) : null,
    forecastError: forecastRes.status === 400 ? FORECAST_400_MESSAGE : "",
  };
}

/** `month` is the displayed first-of-month ISO date ("YYYY-MM-01"); assignments are fetched for it. */
export function useProjectAssignments(
  projectId: string | undefined,
  month: string,
): UseProjectAssignmentsState {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<FetchData>({
    project: null,
    assignments: [],
    participants: [],
    forecast: null,
    forecastError: "",
  });

  // Ignore responses from superseded fetches when the month changes quickly.
  const latestRequest = useRef(0);

  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setError("");
    try {
      const result = await fetchAllForProject(projectId, month);
      if (requestId === latestRequest.current) setData(result);
    } catch {
      if (requestId === latestRequest.current) setError("データの取得に失敗しました");
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
  }, [projectId, month]);

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
    participants: data.participants,
    refresh: fetchAll,
    updateAssignment: mutations.updateAssignment,
    deleteAssignment: mutations.deleteAssignment,
    addParticipant: mutations.addParticipant,
  };
}
