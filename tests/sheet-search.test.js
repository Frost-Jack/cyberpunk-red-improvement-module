import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { activateSheetSearch } from "../scripts/search.js";

beforeEach(() => {
  globalThis.document = { body: {}, activeElement: null };
  document.activeElement = document.body;
});

function control(value = "") {
  return {
    value, selectionStart: value.length, selectionEnd: value.length,
    handlers: new Map(),
    addEventListener(type, callback, options) { this.handlers.set(type, { callback, options }); },
    fire(type) {
      const event = {
        currentTarget: this, prevented: false, stopped: false,
        preventDefault() { this.prevented = true; },
        stopImmediatePropagation() { this.stopped = true; }
      };
      const result = this.handlers.get(type).callback(event);
      return { result, event };
    },
    focus() { document.activeElement = this; },
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  };
}

function fixture(query = "", delayed = false) {
  const gates = [];
  const sheet = {
    options: { cprContentFilter: query }, renders: [],
    _applyContentFilter() { throw new Error("Original search should be replaced"); },
    _clearContentFilter() { throw new Error("Original reset should be replaced"); }
  };
  const mount = value => {
    const input = control(value), anchor = control();
    const icon = { closest: selector => selector === "a" ? anchor : null };
    const root = { querySelector: selector => ({
      ".filter-contents": input, ".reset-content-filter": icon
    })[selector] ?? null };
    sheet.element = [root];
    sheet.input = input;
    sheet.reset = anchor;
    activateSheetSearch(sheet, root);
  };
  sheet._render = async () => {
    const snapshot = sheet.options.cprContentFilter;
    sheet.renders.push(snapshot);
    if (delayed) await new Promise(resolve => gates.push(resolve));
    if (document.activeElement === sheet.input) document.activeElement = document.body;
    mount(snapshot);
    sheet.visibleFilter = snapshot;
  };
  mount(query);
  return { sheet, gates };
}

test("clicking the reset anchor clears both text and filter without native listeners", async () => {
  const { sheet } = fixture("Contortionist");
  const oldInput = sheet.input;
  const click = sheet.reset.fire("click");
  assert.equal(oldInput.value, "");
  assert.equal(sheet.options.cprContentFilter, "");
  assert.equal(click.event.prevented, true);
  assert.equal(click.event.stopped, true);
  assert.equal(sheet.reset.handlers.get("click").options.capture, true);
  await click.result;
  assert.equal(sheet.input.value, "");
  assert.equal(sheet.visibleFilter, "");
  assert.deepEqual(sheet.renders, [""]);
});

test("manually deleting the input clears a previously stored filter", async () => {
  const { sheet } = fixture("Contortionist");
  sheet.input.value = "";
  await sheet.input.fire("input").result;
  assert.equal(sheet.options.cprContentFilter, "");
  assert.equal(sheet.visibleFilter, "");
});

test("input and the system's following keyup produce only one render", async () => {
  const { sheet } = fixture();
  sheet.input.value = "изворот";
  sheet.input.selectionStart = sheet.input.selectionEnd = 7;
  sheet.input.focus();
  await sheet.input.fire("input").result;
  await sheet._applyContentFilter({ currentTarget: sheet.input });
  assert.deepEqual(sheet.renders, ["изворот"]);
  assert.equal(document.activeElement, sheet.input);
  assert.equal(sheet.input.selectionStart, 7);
});

test("reset during an unfinished render cannot restore the old filter", async () => {
  const { sheet, gates } = fixture("", true);
  sheet.input.value = "Contortionist";
  const typing = sheet.input.fire("input").result;
  const clearing = sheet.reset.fire("click").result;
  assert.equal(sheet.input.value, "");
  assert.equal(sheet.options.cprContentFilter, "");
  assert.deepEqual(sheet.renders, ["Contortionist"]);
  gates.shift()();
  await setImmediate();
  assert.deepEqual(sheet.renders, ["Contortionist", ""]);
  gates.shift()();
  await Promise.all([typing, clearing]);
  assert.equal(sheet.input.value, "");
  assert.equal(sheet.visibleFilter, "");
  assert.equal(sheet.options.cprContentFilter, "");
});

test("resetting one sheet leaves another sheet's input and filter unchanged", async () => {
  const first = fixture("Contortionist").sheet;
  const second = fixture("пистолет").sheet;
  second.input.focus();
  await first.reset.fire("click").result;
  assert.equal(first.input.value, "");
  assert.equal(second.input.value, "пистолет");
  assert.equal(second.options.cprContentFilter, "пистолет");
  assert.equal(document.activeElement, second.input);
  assert.deepEqual(second.renders, []);
});

test("new input during a render keeps only the latest query", async () => {
  const { sheet, gates } = fixture("", true);
  sheet.input.value = "Cont";
  const first = sheet.input.fire("input").result;
  sheet.input.value = "Contortionist";
  const last = sheet.input.fire("input").result;
  gates.shift()();
  await setImmediate();
  gates.shift()();
  await Promise.all([first, last]);
  assert.equal(sheet.options.cprContentFilter, "Contortionist");
  assert.equal(sheet.input.value, "Contortionist");
  assert.deepEqual(sheet.renders, ["Cont", "Contortionist"]);
});
