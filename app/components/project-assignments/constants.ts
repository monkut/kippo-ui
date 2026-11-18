/** Usernames of system / placeholder accounts hidden from project-assignment UIs. */
export const EXCLUDED_USERNAMES: ReadonlySet<string> = new Set([
  "(unassigned)",
  "admin",
  "kiconia-api",
  "luca.pacioli",
]);

/** The 月別プロジェクト割当 matrix lists only projects at or above this 確度 (口頭受注 99,
 * 契約(稼働中) 100, 完了 100). Lower-confidence 提案 projects live on プロジェクト状況 (kippo#71). */
export const MATRIX_MIN_CONFIDENCE = 99;

export const MATRIX_CONFIDENCE_RULE = `確度 ${MATRIX_MIN_CONFIDENCE}% 以上 (口頭受注・契約(稼働中)・完了) のプロジェクトのみ表示します。確度 ${MATRIX_MIN_CONFIDENCE}% 未満の提案中プロジェクトは「プロジェクト状況」で確認できます。`;
