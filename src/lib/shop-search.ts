export type SearchableProduct = {
  name: string;
  nameAr: string;
  desc: string;
  descAr: string;
  group?: string;
  groupAr?: string;
};

/** Case-insensitive substring match. The query is not treated as a pattern. */
export function productMatches(product: SearchableProduct, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${product.name} ${product.nameAr} ${product.desc} ${product.descAr} ${product.group ?? ""} ${product.groupAr ?? ""}`
    .toLowerCase()
    .includes(needle);
}

export function sectionsWithMatches<T extends SearchableProduct, S extends { items: T[] }>(sections: S[], query: string) {
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => productMatches(item, query)) }))
    .filter((section) => section.items.length > 0);
}
