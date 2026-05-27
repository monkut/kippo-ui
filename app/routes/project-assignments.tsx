import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Layout } from "~/components/layout";
import {
  MonthPicker,
  MonthlyAssignmentMatrix,
  firstOfMonth,
} from "~/components/project-assignments";
import { useHideUnassignedToggle } from "~/hooks/useHideUnassignedToggle";
import { useMonthlyAssignments } from "~/hooks/useMonthlyAssignments";
import { useAuth } from "~/lib/auth-context";

export function meta() {
  return [{ title: "月別プロジェクト割当 - Kippo" }];
}

export default function ProjectAssignmentsMonthly() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [hideUnassigned, setHideUnassigned] = useHideUnassignedToggle();
  const { isLoading, error, projects, assignments, members } = useMonthlyAssignments(month);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <Layout title="月別プロジェクト割当">
        <LoadingPanel />
      </Layout>
    );
  }
  if (!user) return null;

  return (
    <Layout title="月別プロジェクト割当">
      <div className="space-y-6 w-full max-w-[90vw] mx-auto">
        <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-800">
          注意: 当月の期間内 (start_date ≤ 月末 かつ target_date が空または ≥ 月初)
          のアクティブプロジェクトを表示します。
        </div>
        <MonthPicker month={month} onChange={setMonth} />
        <HideUnassignedToggle checked={hideUnassigned} onChange={setHideUnassigned} />
        {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {isLoading ? (
          <LoadingPanel />
        ) : (
          <MonthlyAssignmentMatrix
            projects={projects}
            assignments={assignments}
            members={members}
            hideUnassigned={hideUnassigned}
          />
        )}
      </div>
    </Layout>
  );
}

function HideUnassignedToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <input
        id="hide-unassigned-members"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
      />
      <label htmlFor="hide-unassigned-members" className="cursor-pointer select-none">
        未割当メンバーを非表示
      </label>
    </div>
  );
}

function LoadingPanel() {
  return <div className="flex justify-center items-center h-64 text-gray-500">読み込み中...</div>;
}
