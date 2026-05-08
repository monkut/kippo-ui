import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Layout } from "~/components/layout";
import {
  MonthPicker,
  MonthlyAssignmentMatrix,
  firstOfMonth,
} from "~/components/project-assignments";
import { useMonthlyAssignments } from "~/hooks/useMonthlyAssignments";
import { useAuth } from "~/lib/auth-context";

export function meta() {
  return [{ title: "月別プロジェクト割当 - Kippo" }];
}

export default function ProjectAssignmentsMonthly() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
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
        <MonthPicker month={month} onChange={setMonth} />
        {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {isLoading ? (
          <LoadingPanel />
        ) : (
          <MonthlyAssignmentMatrix
            projects={projects}
            assignments={assignments}
            members={members}
          />
        )}
      </div>
    </Layout>
  );
}

function LoadingPanel() {
  return <div className="flex justify-center items-center h-64 text-gray-500">読み込み中...</div>;
}
