/** Usernames of system accounts hidden from project-assignment UIs. */
const EXCLUDED_USERNAMES: ReadonlySet<string> = new Set(["admin", "kiconia-api", "luca.pacioli"]);

/** kippo creates one `unassigned-<org>` placeholder user per organization, displayed as
 * "(unassigned)" (backend `UNASSIGNED_USER_GITHUB_LOGIN_PREFIX`). */
const UNASSIGNED_USERNAME_PREFIX = "unassigned";

/** True for system and placeholder accounts, which are never people to assign. */
export const isExcludedUsername = (username: string): boolean =>
  EXCLUDED_USERNAMES.has(username) || username.startsWith(UNASSIGNED_USERNAME_PREFIX);

/** The 月別プロジェクト割当 matrix lists only projects at or above this 確度 (口頭受注 99,
 * 契約(稼働中) 100, 完了 100). Lower-confidence 提案 projects live on プロジェクト状況 (kippo#71). */
export const MATRIX_MIN_CONFIDENCE = 99;

export const MATRIX_CONFIDENCE_RULE = `確度 ${MATRIX_MIN_CONFIDENCE}% 以上 (口頭受注・契約(稼働中)・完了) のプロジェクトのみ表示します。確度 ${MATRIX_MIN_CONFIDENCE}% 未満の提案中プロジェクトは「プロジェクト状況」で確認できます。`;
