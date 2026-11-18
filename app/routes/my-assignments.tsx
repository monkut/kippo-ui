import { useState } from "react";
import { Link } from "react-router";
import { Layout } from "~/components/layout";
import { MAX_PERCENTAGE_PER_MONTH } from "~/components/project-assignments/utils";
import { useAuthGate } from "~/hooks/useAuthGate";
import { useMyAssignments } from "~/hooks/useMyAssignments";
import type { KippoProject } from "~/lib/api/generated/models";
import { addMonths, firstOfMonth, formatMonth } from "~/lib/dates";
import {
  MY_ASSIGNMENTS_MONTHS_BEFORE,
  MY_ASSIGNMENTS_WINDOW_MONTHS,
  type MyAssignmentsColumn,
  type MyAssignmentsMatrix,
} from "~/lib/my-assignments";

const PAGE_TITLE = "自分の割当";
const PAGER_STEP_MONTHS = 6;
const PAGER_BUTTON_CLASS =
  "px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50";

export function meta() {
  return [{ title: "自分の割当 - Kippo" }];
}

function defaultStartMonth(): string {
  return addMonths(firstOfMonth(new Date()), -MY_ASSIGNMENTS_MONTHS_BEFORE);
}

export default function MyAssignments() {
  const { user, authLoading } = useAuthGate();
  const [startMonth, setStartMonth] = useState(defaultStartMonth);
  const state = useMyAssignments(user?.username, startMonth);

  if (authLoading) {
    return (
      <Layout title={PAGE_TITLE}>
        <LoadingPanel />
      </Layout>
    );
  }
  if (!user) return null;

  const endMonth = addMonths(startMonth, MY_ASSIGNMENTS_WINDOW_MONTHS - 1);
  const isDefaultWindow = startMonth === defaultStartMonth();

  return (
    <Layout title={PAGE_TITLE}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="bg-white shadow rounded-lg p-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            aria-label="前の期間"
            className={PAGER_BUTTON_CLASS}
            onClick={() => setStartMonth(addMonths(startMonth, -PAGER_STEP_MONTHS))}
          >
            ◀
          </button>
          <span className="text-lg font-semibold text-gray-900">
            {formatMonth(startMonth)} 〜 {formatMonth(endMonth)}
          </span>
          <button
            type="button"
            aria-label="次の期間"
            className={PAGER_BUTTON_CLASS}
            onClick={() => setStartMonth(addMonths(startMonth, PAGER_STEP_MONTHS))}
          >
            ▶
          </button>
          {!isDefaultWindow && (
            <button
              type="button"
              className="ml-auto px-3 py-1.5 text-sm font-medium text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50"
              onClick={() => setStartMonth(defaultStartMonth())}
            >
              今月へ戻る
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600">
          閲覧専用です。割当の追加・変更は月別プロジェクト割当またはプロジェクトページで行ってください。
        </p>
        {state.error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{state.error}</div>
        )}
        {state.isLoading ? (
          <LoadingPanel />
        ) : (
          <MyAssignmentsTable matrix={state.matrix} projectsById={state.projectsById} />
        )}
      </div>
    </Layout>
  );
}

function MyAssignmentsTable({
  matrix,
  projectsById,
}: {
  matrix: MyAssignmentsMatrix;
  projectsById: ReadonlyMap<string, KippoProject>;
}) {
  if (matrix.columns.length === 0) {
    return (
      <section className="bg-white shadow rounded-lg p-6">
        <p className="text-sm text-gray-500">この期間の割当はありません。</p>
      </section>
    );
  }
  const currentMonth = firstOfMonth(new Date());
  return (
    <section className="bg-white shadow rounded-lg p-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 align-bottom">
            <th className="py-2 pr-4 whitespace-nowrap">月</th>
            {matrix.columns.map((column) => (
              <ProjectHeader
                key={column.projectId}
                column={column}
                project={projectsById.get(column.projectId)}
              />
            ))}
            <th className="py-2 px-3 text-right whitespace-nowrap">月合計</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => {
            const over = row.total > MAX_PERCENTAGE_PER_MONTH;
            return (
              <tr
                key={row.month}
                className={`border-b border-gray-100 ${row.month === currentMonth ? "bg-indigo-50" : ""}`}
              >
                <td className="py-2 pr-4 font-medium text-gray-900 whitespace-nowrap">
                  {formatMonth(row.month)}
                </td>
                {matrix.columns.map((column) => {
                  const percent = row.percentByProject.get(column.projectId);
                  return (
                    <td key={column.projectId} className="py-2 px-3 text-right text-gray-900">
                      {percent === undefined ? "" : `${percent}%`}
                    </td>
                  );
                })}
                <td
                  className={`py-2 px-3 text-right font-semibold whitespace-nowrap ${over ? "text-red-700" : "text-gray-900"}`}
                  title={over ? `${row.total}% — 100%を超えています` : undefined}
                >
                  {row.total > 0 ? `${row.total}%` : ""}
                  {over && " ⚠"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function ProjectHeader({
  column,
  project,
}: {
  column: MyAssignmentsColumn;
  project: KippoProject | undefined;
}) {
  const confidence =
    typeof project?.confidence === "number" ? ` · 確度 ${project.confidence}%` : "";
  return (
    <th className="py-2 px-3 text-right font-normal min-w-[8rem]">
      <Link
        to={`/projects/${column.projectId}/assignments`}
        className="block font-medium text-indigo-700 hover:underline"
      >
        {column.projectName}
      </Link>
      {project && (
        <span className="block text-gray-500">
          {project.customer_name}
          <br />
          {project.phase_display}
          {confidence}
        </span>
      )}
    </th>
  );
}

function LoadingPanel() {
  return <div className="flex justify-center items-center h-64 text-gray-500">読み込み中...</div>;
}
