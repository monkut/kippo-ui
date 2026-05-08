import { useCallback, useEffect, useState } from "react";
import { monthlyAssignmentsList } from "~/lib/api/generated/monthly-assignments/monthly-assignments";
import type { KippoProject, ProjectForecastResponse, ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import {
  projectsForecastRetrieve,
  projectsRetrieve,
} from "~/lib/api/generated/projects/projects";

export type UseProjectAssignmentsState = {
  isLoading: boolean;
  error: string;
  project: KippoProject | null;
  forecast: ProjectForecastResponse | null;
  forecastError: string;
  assignments: ProjectMonthlyAssignment[];
  refresh: () => Promise<void>;
};

const FORECAST_400_MESSAGE = "プロジェクトの開始日が設定されていないため、完了予測を計算できません。";

type ForecastResponseOr400 =
  | { status: 200; data: ProjectForecastResponse }
  | { status: 400; data: undefined }
  | { status: number; data?: unknown };

async function fetchForecastTolerating400(projectId: string): Promise<ForecastResponseOr400> {
  // Forecast endpoint returns 400 when project.start_date is null. Surface that as a
  // forecastError on the hook return without failing the whole view — the assignments
  // table is still useful.
  try {
    return await projectsForecastRetrieve(projectId);
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 400) return { status: 400, data: undefined };
    throw err;
  }
}

export function useProjectAssignments(projectId: string | undefined): UseProjectAssignmentsState {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState<KippoProject | null>(null);
  const [forecast, setForecast] = useState<ProjectForecastResponse | null>(null);
  const [forecastError, setForecastError] = useState("");
  const [assignments, setAssignments] = useState<ProjectMonthlyAssignment[]>([]);

  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError("");
    setForecastError("");
    try {
      const [projectRes, assignmentsRes, forecastRes] = await Promise.all([
        projectsRetrieve(projectId),
        monthlyAssignmentsList({ project: projectId }),
        fetchForecastTolerating400(projectId),
      ]);
      if (projectRes.status === 200) setProject(projectRes.data);
      if (assignmentsRes.data?.results) setAssignments(assignmentsRes.data.results);
      if (forecastRes.status === 200) setForecast(forecastRes.data as ProjectForecastResponse);
      else if (forecastRes.status === 400) setForecastError(FORECAST_400_MESSAGE);
    } catch {
      setError("データの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { isLoading, error, project, forecast, forecastError, assignments, refresh: fetchAll };
}
