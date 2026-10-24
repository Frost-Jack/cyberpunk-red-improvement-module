import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { openAdvancement } from "../scripts/advancement.js";

const hooks = new Map();
const dialogs = [];
const notices = [];
let app;

globalThis.Hooks = {
  once: (name, fn) => hooks.set(name, fn),
  on: (name, fn) => hooks.set(name, fn)
};
globalThis.foundry = { utils: {
  deepClone: structuredClone,
  mergeObject: (a, b) => ({ ...a, ...b })
} };
globalThis.Application = class {
  static get defaultOptions() { return {}; }
  render() { this.rendered = true; return this; }
  bringToTop() { this.raised = true; }
  async close() { this.rendered = false; }
};
globalThis.Dialog = class {
  constructor(options) { this.options = options; this.handlers = new Map(); this.values = {}; }
  render() {
    const html = { find: selector => ({
      on: (event, fn) => this.handlers.set(`${selector}:${event}`, fn),
      val: () => this.values[selector],
      text: value => { this.message = value; }
    }) };
    this.options.render(html);
    dialogs.push(this);
  }
  confirm(values = {}) {
    this.values = values;
    this.handlers.get("[data-ok]:click")();
  }
  close() { this.options.close(); }
};
globalThis.window = { innerWidth: 1440, innerHeight: 1000 };
globalThis.ui = { notifications: Object.fromEntries(
  ["info", "warn", "error"].map(kind => [kind, message => notices.push([kind, message])])
) };
globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ actor: actor.id }),
  create: async data => { globalThis.lastChat = data; }
};

await import("../scripts/module.js");

function item(id, type = "skill", system = {}) {
  const data = {
    _id: id, name: id, type,
    system: type === "role"
      ? { rank: 4, mainRoleAbility: "Interface", abilities: [], ...system }
      : { level: 2, difficulty: "typical", category: "bodySkills", ...system }
  };
  return { ...structuredClone(data), id, toObject() {
    return { ...structuredClone(data), system: structuredClone(this.system) };
  } };
}

function assign(target, update) {
  for (const [path, value] of Object.entries(update)) {
    if (path === "_id") continue;
    const parts = path.split(".");
    const field = parts.pop();
    const parent = parts.reduce((obj, key) => obj[key], target);
    parent[field] = structuredClone(value);
  }
}

function actor(id = "A", items = [item("Athletics")], ip = 1000) {
  items.get = key => items.find(entry => entry.id === key);
  return {
    id, uuid: `Actor.${id}`, name: id, type: "character", isOwner: true,
    img: "icons/svg/mystery-man.svg", items,
    system: { improvementPoints: { value: ip, transactions: [] } },
    async updateEmbeddedDocuments(type, updates) {
      updates.forEach(update => assign(this.items.get(update._id), update));
    },
    async createEmbeddedDocuments(type, entries) {
      const added = entries.map((data, i) => item(`new-${i}`, data.type, data.system));
      this.items.push(...added);
      return added;
    },
    async deleteEmbeddedDocuments(type, ids) {
      for (const id of ids) this.items.splice(this.items.findIndex(i => i.id === id), 1);
    },
    async update(data) { assign(this, data); }
  };
}

function open(character) {
  globalThis.game.actors = [character];
  app = openAdvancement(character);
  // UI rendering is tested separately; domain tests do not need a browser DOM.
  app.paint = () => {};
  return app;
}

beforeEach(() => {
  dialogs.length = 0;
  notices.length = 0;
  globalThis.lastChat = undefined;
  globalThis.game = {
    system: { id: "cyberpunk-red-core" },
    i18n: { lang: "en", localize: key => key,
      format: (key, values) => `${key}: ${values.amount} -> ${values.total}` },
    actors: [], packs: new Map(),
    modules: new Map([["cyberpunk-red-improvement-module", {}]])
  };
});

afterEach(async () => {
  dialogs.splice(0).forEach(dialog => dialog.close());
  if (app) { app.busy = false; await app.close(); app = undefined; }
});

test("entry point uses the sheet actor, reuses the window and switches actors", () => {
  const first = actor("sheet");
  const second = actor("other");
  globalThis.canvas = { tokens: { controlled: [{ actor: second }] } };
  const leveler = open(first);
  assert.equal(leveler.actor, first);
  assert.equal(openAdvancement(first), leveler);
  assert.equal(openAdvancement(second), leveler);
  assert.equal(leveler.actor, second);
  leveler.busy = true;
  openAdvancement(first);
  assert.equal(leveler.actor, second);
});

test("permissions and system checks reject invalid actors", () => {
  const character = actor();
  character.isOwner = false;
  assert.equal(openAdvancement(character), undefined);
  character.isOwner = true;
  character.type = "mook";
  assert.equal(openAdvancement(character), undefined);
  game.system.id = "other";
  assert.equal(openAdvancement(actor()), undefined);
  assert.equal(notices.length, 3);
});

test("costs include every purchased rank at standard, difficult and role rates", () => {
  const leveler = open(actor("A", [
    item("normal"), item("hard", "skill", { difficulty: "difficult" }), item("role", "role")
  ]));
  leveler.setTarget("normal", 4); // 60 + 80
  leveler.setTarget("hard", 4); // 120 + 160
  leveler.setTarget("role", 5); // 300
  assert.deepEqual(leveler.plan().map(row => row.cost), [140, 280, 300]);
  assert.equal(leveler.total(), 720);
  leveler.setTarget("normal", 99);
  assert.equal(leveler.target(leveler.rows[0]), 10);
  leveler.setTarget("normal", -10);
  assert.equal(leveler.target(leveler.rows[0]), 2);
});

test("successful purchase updates ranks, balance, ledger and chat", async () => {
  const character = actor();
  const leveler = open(character);
  leveler.setTarget("Athletics", 4);
  const pending = leveler.apply();
  dialogs.shift().confirm();
  await pending;
  assert.equal(character.items[0].system.level, 4);
  assert.equal(character.system.improvementPoints.value, 860);
  assert.equal(character.system.improvementPoints.transactions.length, 1);
  assert.match(lastChat.content, /140 IP/);
  assert.equal(leveler.plan().length, 0);
});

test("refund restores the sum of removed ranks", async () => {
  const character = actor();
  const leveler = open(character);
  leveler.mode = "refund";
  leveler.setTarget("Athletics", 0);
  const pending = leveler.apply();
  dialogs.shift().confirm();
  await pending;
  assert.equal(character.items[0].system.level, 0);
  assert.equal(character.system.improvementPoints.value, 1060);
});

test("insufficient IP, cancelled confirmation and stale data cannot spend points", async () => {
  const character = actor("A", undefined, 59);
  const leveler = open(character);
  leveler.setTarget("Athletics", 3);
  await leveler.apply();
  assert.equal(dialogs.length, 0);
  character.system.improvementPoints.value = 100;
  leveler.refresh();
  leveler.setTarget("Athletics", 3);
  const cancelled = leveler.apply();
  dialogs.shift().close();
  await cancelled;
  const stale = leveler.apply();
  character.items[0].system.level = 5;
  dialogs.shift().confirm();
  const log = console.error;
  console.error = () => {};
  try { await stale; } finally { console.error = log; }
  assert.equal(character.system.improvementPoints.value, 100);
  assert.match(notices.at(-1)[1], /changed/);
});

test("failed actor write rolls back purchased ranks", async () => {
  const character = actor();
  character.update = async () => { throw new Error("write failed"); };
  const leveler = open(character);
  leveler.setTarget("Athletics", 3);
  const pending = leveler.apply();
  dialogs.shift().confirm();
  const log = console.error;
  console.error = () => {};
  try { await pending; } finally { console.error = log; }
  assert.equal(character.items[0].system.level, 2);
  assert.equal(character.system.improvementPoints.value, 1000);
  assert.equal(lastChat, undefined);
});

test("new roles require current rank 4, cost 60 IP and are created on confirmation", async () => {
  const character = actor("A", [item("existing", "role", { rank: 3 })]);
  const leveler = open(character);
  await leveler.addRole();
  assert.match(notices.at(-1)[1], /Rank 4/);
  leveler.setTarget("existing", 4);
  game.packs.set("cyberpunk-red-core.core_roles", {
    getDocuments: async () => [item("fixer", "role", { mainRoleAbility: "Operator" })]
  });
  const adding = leveler.addRole();
  await setImmediate();
  dialogs.shift().confirm({ "[data-role]": "fixer" });
  await adding;
  assert.equal(leveler.newRole.data.system.rank, 0);
  assert.equal(leveler.plan().find(row => row.id === "new").cost, 60);
  const saving = leveler.apply();
  dialogs.shift().confirm();
  await saving;
  assert.equal(character.items.length, 2);
  assert.equal(character.items[1].system.rank, 1);
  assert.equal(character.system.improvementPoints.value, 700);
});

test("role allocation validates the budget and derives Medtech skills", async () => {
  const role = item("medtech", "role", { mainRoleAbility: "Medicine", abilities: [
    { name: "Surgery", rank: 1 },
    { name: "Medical Tech (Pharmaceuticals)", rank: 1 },
    { name: "Medical Tech (Cryosystem Operation)", rank: 2 },
    { name: "Surgery Skill", rank: 2 },
    { name: "Medical Tech Skill", rank: 3 }
  ] });
  const leveler = open(actor("A", [role]));
  const result = leveler.allocate({ ...leveler.rows[0], to: 5 });
  const dialog = dialogs.shift();
  dialog.confirm({ '[data-alloc="0"]': 2, '[data-alloc="1"]': 2, '[data-alloc="2"]': 2 });
  assert.match(dialog.message, /6 \/ 5/);
  dialog.confirm({ '[data-alloc="0"]': 1, '[data-alloc="1"]': 2, '[data-alloc="2"]': 2 });
  assert.deepEqual((await result).map(ability => ability.rank), [1, 2, 2, 2, 4]);
});

test("Tech uses two specialties per rank and Solo respects ability multipliers", async () => {
  const leveler = open(actor());
  for (const [main, values, expected] of [
    ["Maker", [4, 6], [4, 6]],
    ["Combat Awareness", [1, 3], [1, 3]]
  ]) {
    const row = {
      category: "roles", base: 4, to: 5, data: {
        name: main, system: { mainRoleAbility: main, abilities: [
          { name: "First", rank: 0, multiplier: 2 },
          { name: "Second", rank: 4, multiplier: 1 }
        ] }
      }
    };
    const allocation = leveler.allocate(row);
    dialogs.shift().confirm({ '[data-alloc="0"]': values[0], '[data-alloc="1"]': values[1] });
    assert.deepEqual((await allocation).map(ability => ability.rank), expected);
  }
});

test("failed balance write removes a newly purchased role", async () => {
  const character = actor("A", [item("existing", "role")]);
  const leveler = open(character);
  leveler.newRole = {
    id: "new", data: item("new", "role", { mainRoleAbility: "Operator", rank: 0 }).toObject(),
    base: 0, rate: 60, category: "roles"
  };
  leveler.targets.set("new", 1);
  character.update = async () => { throw new Error("write failed"); };
  const saving = leveler.apply();
  dialogs.shift().confirm();
  const log = console.error;
  console.error = () => {};
  try { await saving; } finally { console.error = log; }
  assert.equal(character.items.length, 1);
  assert.equal(character.system.improvementPoints.value, 1000);
});

test("Russian interface and Babele original names remain supported", () => {
  game.i18n.lang = "ru";
  const skill = item("Атлетика");
  skill.flags = { babele: { originalName: "Athletics" } };
  const leveler = open(actor("A", [skill]));
  assert.match(leveler.markup(), /Повышение/);
  assert.equal(leveler.rowName(leveler.rows[0]), "Атлетика");
  assert.match(leveler.tablesHTML(), /Обычный/);
});

test("sheet arrow follows IP, ownership and actor type; repeated renders do not duplicate it", () => {
  const buttons = [];
  const points = { append: button => buttons.push(button) };
  const root = {
    querySelectorAll: () => [...buttons],
    querySelector: selector => selector === ".actor-details-improvement-points" ? points : null
  };
  globalThis.document = { createElement: () => ({
    dataset: {}, setAttribute() {},
    addEventListener(event, callback) { this.click = callback; },
    remove() { buttons.splice(buttons.indexOf(this), 1); }
  }) };
  const character = actor("sheet");
  const render = () => hooks.get("renderActorSheet")({ actor: character }, [root]);
  hooks.get("init")();
  assert.equal(game.modules.get("cyberpunk-red-improvement-module").api.open, openAdvancement);
  render(); render();
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].type, "button");
  buttons[0].click({ preventDefault() {}, stopPropagation() {} });
  app = openAdvancement(character);
  assert.equal(app.actor, character);
  character.system.improvementPoints.value = 0;
  render();
  assert.equal(buttons.length, 0);
  character.system.improvementPoints.value = 20;
  character.isOwner = false;
  render();
  assert.equal(buttons.length, 0);
  character.isOwner = true;
  character.type = "mook";
  render();
  assert.equal(buttons.length, 0);
});

test("sheet search reset also binds to read-only characters with zero IP", async () => {
  const input = { value: "Contortionist", addEventListener() {} };
  let reset;
  const anchor = { addEventListener(type, callback) { reset = callback; } };
  const icon = { closest: () => anchor };
  const root = {
    querySelectorAll: () => [],
    querySelector: selector => ({
      ".filter-contents": input, ".reset-content-filter": icon
    })[selector] ?? null
  };
  const character = actor("read-only", undefined, 0);
  character.isOwner = false;
  const sheet = {
    actor: character, options: { editable: false, cprContentFilter: "Contortionist" },
    async _render() { this.renderedFilter = this.options.cprContentFilter; }
  };
  hooks.get("renderActorSheet")(sheet, [root]);
  await reset({ preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(input.value, "");
  assert.equal(sheet.options.cprContentFilter, "");
  assert.equal(sheet.renderedFilter, "");
});
