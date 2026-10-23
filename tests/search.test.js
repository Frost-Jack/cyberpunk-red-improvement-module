import assert from "node:assert/strict";
import { test } from "node:test";
import { installBilingualSearch, matchesName } from "../scripts/search.js";

test("skill search accepts English, system Russian and macro Russian names", () => {
  for (const name of ["Contortionist", "Изворотливость", "Акробатика"]) {
    for (const query of ["Contortionist", "cOnToRt", "изворот", "АКРОБАТИКА"]) {
      assert.equal(matchesName(query, name), true, `${query}: ${name}`);
    }
  }
  assert.equal(matchesName("Contortionist", "Stealth"), false);
  assert.equal(matchesName("  ", "Stealth"), true);
  assert.equal(matchesName("тяжелое", "Heavy Weapons"), true);
});

test("equipment search accepts either language and keeps literal custom names", () => {
  assert.equal(matchesName("Air Pistol", "Пневматический пистолет"), true);
  assert.equal(matchesName("пневматический", "Air Pistol"), true);
  assert.equal(matchesName("любимый", "Мой любимый пистолет"), true);
  assert.equal(matchesName("Air Pistol", "Мой пистолет", "Air Pistol"), true);
});

test("system helper preserves its original behavior and adds aliases only for characters", () => {
  let calls = 0;
  const original = function(query, name) {
    calls++;
    assert.equal(this.testContext, true);
    return query === undefined || name.toLowerCase().includes(query.toLowerCase());
  };
  globalThis.Handlebars = {
    helpers: { cprSheetContentFilter: original },
    registerHelper(name, callback) { this.helpers[name] = callback; }
  };
  installBilingualSearch();
  const filter = Handlebars.helpers.cprSheetContentFilter;
  const context = { testContext: true };
  const options = { data: { root: { actor: { type: "character" } } } };
  assert.equal(filter.call(context, "Contortionist", "Изворотливость", options), true);
  assert.equal(filter.call(context, "изворот", "Contortionist", options), true);
  assert.equal(filter.call(context, "Air Pistol", "Пневматический пистолет", options), true);
  assert.equal(filter.call(context, "custom", "My custom skill", options), true);
  assert.equal(filter.call(context, undefined, "Any name", options), true);
  assert.equal(filter.call(context, "Contortionist", "Изворотливость", {
    data: { root: { actor: { type: "mook" } } }
  }), false);
  assert.equal(filter.call(context, "missing", "Contortionist", options), false);
  assert.equal(calls, 7);
});

test("system helper uses Babele original names without changing the document", () => {
  globalThis.Handlebars = {
    helpers: { cprSheetContentFilter: () => false },
    registerHelper(name, callback) { this.helpers[name] = callback; }
  };
  installBilingualSearch();
  const item = { name: "Мой пистолет", flags: { babele: { originalName: "Custom Pistol" } } };
  const snapshot = structuredClone(item);
  assert.equal(Handlebars.helpers.cprSheetContentFilter.call(item,
    "custom", item.name, { data: { root: { actor: { type: "character" } } } }
  ), true);
  assert.deepEqual(item, snapshot);
});
