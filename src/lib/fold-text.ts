/** Shared letter fold for search. Display strings stay as typed. */
const MARKS = /[\u0640\u064B-\u065F\u0670]/g;

export function foldText(text: string) {
  return text
    .toLowerCase()
    .replace(MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/\s+/g, " ")
    .trim();
}
