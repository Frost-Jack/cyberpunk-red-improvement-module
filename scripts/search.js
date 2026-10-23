import { names } from "./names.js";
import { searchNames } from "./search-names.js";

const normalize = value => String(value ?? "").normalize("NFKC").toLowerCase()
  .replace(/ё/g, "е").trim();
const aliases = new Map();

for (const group of [...Object.entries(names), ...searchNames]) {
  const variants = new Set(group.map(normalize).filter(Boolean));
  for (const name of variants) {
    for (const alias of aliases.get(name) ?? []) variants.add(alias);
  }
  for (const name of variants) aliases.set(name, variants);
}

export function matchesName(query, ...values) {
  const term = normalize(query);
  if (!term) return true;
  for (const value of values) {
    const name = normalize(value);
    for (const alias of aliases.get(name) ?? [name]) {
      if (alias.includes(term)) return true;
    }
  }
  return false;
}

export function installBilingualSearch() {
  const original = Handlebars.helpers.cprSheetContentFilter;
  if (typeof original !== "function") return;
  Handlebars.registerHelper("cprSheetContentFilter", function(query, name, options) {
    if (original.call(this, query, name, options)) return true;
    if (options?.data?.root?.actor?.type !== "character") return false;
    return matchesName(query, name, this.name, this.flags?.babele?.originalName);
  });
}
