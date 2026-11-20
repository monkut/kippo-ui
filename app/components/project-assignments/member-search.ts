import type { OrganizationMember } from "~/lib/api/generated/models";

const KATAKANA = /[ァ-ヶ]/g;
const KANA_OFFSET = 0x60;

/** Width-, case- and kana-insensitive form for matching: NFKC (全角 → 半角, 半角カナ → 全角),
 * lower case, and katakana → hiragana, so "ｶｲｾｲ", "カイセイ" and "かいせい" match each other. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(KATAKANA, (c) => String.fromCharCode(c.charCodeAt(0) - KANA_OFFSET));
}

/** True when every whitespace-separated term of `query` appears in the member's name (English or
 * Japanese, as stored), username or GitHub login. Term order is free: "kaiho goro" matches
 * "goro kaiho". An empty query matches every member. */
export function memberMatchesQuery(member: OrganizationMember, query: string): boolean {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeForSearch(
    [member.display_name, member.username, member.github_login].join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}
