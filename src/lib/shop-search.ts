import { foldText } from "./fold-text.ts";
import { queryTokens, synonymForms } from "./synonyms.ts";

export type SearchableProduct = {
  name: string;
  nameAr: string;
  desc: string;
  descAr: string;
  group?: string;
  groupAr?: string;
};

function wordBag(text: string) {
  const bag = new Set<string>();
  for (const part of foldText(text).split(/[^\p{L}\p{N}]+/u)) {
    if (part.length < 2) continue;
    bag.add(part);
    if (part.startsWith("ال") && part.length > 4) bag.add(part.slice(2));
  }
  return bag;
}

/** Folded whole words plus the synonym list. The query is never used as a pattern. */
export function productMatches(product: SearchableProduct, query: string) {
  const needle = query.trim();
  if (!needle) return true;
  const tokens = queryTokens(needle);
  if (!tokens.length) return false;
  const bag = wordBag(`${product.name} ${product.nameAr} ${product.desc} ${product.descAr} ${product.group ?? ""} ${product.groupAr ?? ""}`);
  return tokens.every((token) => synonymForms(token).some((form) => bag.has(form)));
}

export function sectionsWithMatches<T extends SearchableProduct, S extends { items: T[] }>(sections: S[], query: string) {
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => productMatches(item, query)) }))
    .filter((section) => section.items.length > 0);
}
