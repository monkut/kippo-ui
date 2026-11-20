import { describe, expect, test } from "vitest";
import {
  memberMatchesQuery,
  normalizeForSearch,
} from "../app/components/project-assignments/member-search";
import type { OrganizationMember } from "../app/lib/api/generated/models";

const member = (over: Partial<OrganizationMember>) =>
  ({
    user_id: "u1",
    username: "goro.kaiho",
    display_name: "goro kaiho (kaiho-goro)",
    github_login: "kaiho-goro",
    is_developer: true,
    is_project_manager: false,
    ...over,
  }) as OrganizationMember;

const japanese = member({
  username: "kaisei.deguchi",
  display_name: "カイセイ 出口 (ka714)",
  github_login: "ka714",
});

describe("memberMatchesQuery", () => {
  test.each([
    ["", true],
    ["Goro", true], // case-insensitive English name
    ["kaiho goro", true], // terms in any order
    ["kaiho-goro", true], // GitHub login
    ["goro.kaiho", true], // username
    ["ｇｏｒｏ", true], // full-width input
    ["tanaka", false],
  ])("English-name member, query %j → %s", (query, expected) => {
    expect(memberMatchesQuery(member({}), query)).toBe(expected);
  });

  test.each([
    ["出口", true], // Japanese name
    ["かいせい", true], // hiragana matches katakana
    ["ｶｲｾｲ", true], // half-width katakana
    ["ka714", true],
    ["deguchi", true], // username
    ["山田", false],
  ])("Japanese-name member, query %j → %s", (query, expected) => {
    expect(memberMatchesQuery(japanese, query)).toBe(expected);
  });
});

test("normalizeForSearch folds width, case and kana", () => {
  expect(normalizeForSearch("ＡＢｶｲセイ")).toBe("abかいせい");
});
