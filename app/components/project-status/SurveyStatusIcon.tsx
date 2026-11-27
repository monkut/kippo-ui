import type { SurveyUserInline } from "~/lib/api/generated";

// Surveys are only assigned to effort users with >3% effort, so survey_users
// may not contain every effort user. Three render states keep the row from
// going blank when no survey is assigned (issue #33).
export function SurveyStatusIcon({ surveyUser }: { surveyUser: SurveyUserInline | undefined }) {
  if (surveyUser === undefined) {
    return (
      <svg
        className="w-4 h-4 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
      >
        <title>user not considered: &lt;= 3% effort in project</title>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
    );
  }
  if (surveyUser.survey_completed) {
    return (
      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
        <title>アンケート完了</title>
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg
      className="w-4 h-4 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
    >
      <title>アンケート未完了</title>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
