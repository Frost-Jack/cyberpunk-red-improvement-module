import { names } from "./names.js";
import { searchNames } from "./search-names.js";

const normalize = value => String(value ?? "").normalize("NFKC").toLowerCase()
  .replace(/ё/g, "е").trim();
const aliases = new Map();
const sheetSearch = new WeakMap();

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

export function activateSheetSearch(sheet, root) {
  const input = root.querySelector(".filter-contents");
  const icon = root.querySelector(".reset-content-filter");
  if (!input || !icon) return;

  let state = sheetSearch.get(sheet);
  if (!state) {
    state = { query: sheet.options.cprContentFilter ?? "", revision: 0, pending: null };
    sheetSearch.set(sheet, state);

    const update = (query, selection = null) => {
      const changed = query !== state.query || query !== sheet.options.cprContentFilter;
      state.query = query;
      state.selection = selection;
      state.input.value = query;
      sheet.options.cprContentFilter = query;
      if (!changed) return state.pending;
      state.revision++;
      if (state.pending) return state.pending;

      state.pending = (async () => {
        let revision;
        do {
          revision = state.revision;
          await sheet._render();
        } while (revision !== state.revision);

        const field = state.input;
        field.value = state.query;
        if (state.selection && (document.activeElement === document.body
          || document.activeElement === field)) {
          field.focus();
          field.setSelectionRange(state.selection.start, state.selection.end);
        }
      })().finally(() => { state.pending = null; });
      return state.pending;
    };

    // The system's existing keyup and tab listeners resolve these methods on the sheet.
    sheet._applyContentFilter = event => update(event.currentTarget.value, {
      start: event.currentTarget.selectionStart,
      end: event.currentTarget.selectionEnd
    });
    sheet._clearContentFilter = () => update("");
  }

  if (state.input === input) return;
  state.input = input;
  if (state.pending) input.value = state.query;
  input.addEventListener("input", event => sheet._applyContentFilter(event));
  const reset = icon.closest("a") ?? icon;
  reset.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    return sheet._clearContentFilter();
  }, { capture: true });
}
