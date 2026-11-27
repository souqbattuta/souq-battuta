import { foldText } from "./fold-text.ts";

/**
 * Matching only. Do not show these spellings as labels.
 * A query that hits any form in a row hits the others.
 * Folded كنافة is كنافه, so both sit on the knafeh row.
 */
export const MATCH_SYNONYMS: readonly (readonly string[])[] = [
  ["knafeh", "kunafeh", "kunafa", "konafa", "كنافة", "كنافه"],
  ["falafel", "falafil", "فلافل"],
  ["hummus", "houmous", "hummos", "hommos", "حمص"],
  ["shawarma", "shawerma", "shwarma", "شاورما"],
  ["manakish", "manaqeesh", "manakeesh", "مناقيش"],
  ["maqluba", "maklouba", "مقلوبة"],
  ["mansaf", "منسف"],
  ["kaak", "كعك"],
];

const groups = MATCH_SYNONYMS.map((row) => [...new Set(row.map((word) => foldText(word)).filter((word) => word.length >= 2))]);

const byForm = new Map<string, string[]>();
for (const group of groups) {
  for (const form of group) byForm.set(form, group);
}

export function synonymForms(word: string) {
  const folded = foldText(word);
  if (folded.length < 2) return [];
  return byForm.get(folded) ?? [folded];
}

function bare(word: string) {
  return word.startsWith("ال") && word.length > 4 ? word.slice(2) : word;
}

/** Query words, folded, with a leading ال removed. Not a pattern. */
export function queryTokens(query: string) {
  return foldText(query)
    .split(/[^\p{L}\p{N}]+/u)
    .map(bare)
    .filter((part) => part.length >= 2);
}
