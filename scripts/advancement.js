// Cyberpunk RED / Foundry VTT v12.
// Original: Christino Phrappuccino / Sean Westberg.
// Russian terminology: BarsiK.

import { names } from "./names.js";
import { matchesName } from "./search.js";

let activeLeveler = null;

export function openAdvancement(actor) {
  const ru = /^ru(?:$|-|_)/i.test(game.i18n.lang);
  const tr = (en, rus) => ru ? rus : en;
  const esc = value => String(value ?? "").replace(/[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  const clone = value => foundry.utils.deepClone(value);

  const reverse = new Map(
    Object.entries(names).map(([en, rus]) => [rus.toLowerCase(), en])
  );

  const canonical = name =>
    reverse.get(String(name).toLowerCase()) ?? String(name ?? "");

  const label = name =>
    ru ? names[canonical(name)] ?? name : canonical(name);

  const itemName = item =>
    item.flags?.babele?.originalName ?? item.name;

  const cats = {
    roles: ["Roles", "Роли", "user-tie"],
    awarenessSkills: ["Awareness Skills", "Навыки восприятия", "eye"],
    bodySkills: ["Body Skills", "Физические навыки", "person-running"],
    controlSkills: ["Control Skills", "Навыки управления", "car"],
    educationSkills: ["Education Skills", "Навыки образования", "book"],
    fightingSkills: ["Fighting Skills", "Навыки ближнего боя", "hand-fist"],
    performanceSkills: ["Performance Skills", "Сценические навыки", "masks-theater"],
    rangedweaponSkills: [
      "Ranged Weapon Skills",
      "Навыки дистанционного оружия",
      "crosshairs"
    ],
    socialSkills: ["Social Skills", "Социальные навыки", "comments"],
    techniqueSkills: [
      "Technique Skills",
      "Технические навыки",
      "screwdriver-wrench"
    ],
    other: ["Other Skills", "Другие навыки", "list"]
  };

  const catName = key => cats[key]?.[ru ? 1 : 0] ?? key;

  const roleNames = {
    Teamwork: ["Exec", "Экзек"],
    Operator: ["Fixer", "Фиксер"],
    Backup: ["Lawman", "Законник"],
    Credibility: ["Media", "Журналист"],
    Medicine: ["Medtech", "Медтехник"],
    Interface: ["Netrunner", "Нетраннер"],
    Moto: ["Nomad", "Кочевник"],
    "Charismatic Impact": ["Rockerboy", "Рокербой"],
    "Combat Awareness": ["Solo", "Соло"],
    Maker: ["Tech", "Техник"]
  };

  const rank = item => Number(
    item.type === "role" ? item.system.rank : item.system.level
  );

  const rate = item => item.type === "role"
    ? 60
    : ({
      typical: 20,
      difficult: 40,
      role: 60
    }[item.system.difficulty] ?? 20);

  const cost = (from, to, step) =>
    step * Math.abs(to * (to + 1) - from * (from + 1)) / 2;

  const owned = () => game.actors.filter(
    a => a.type === "character" && a.isOwner
  );

  const title = tr(
    "Character Level Up",
    "Повышение уровня персонажа"
  );

  if (game.system.id !== "cyberpunk-red-core") {
    ui.notifications.error(tr(
      "Requires Cyberpunk RED - CORE.",
      "Нужна система Cyberpunk RED - CORE."
    ));
    return;
  }

  if (actor?.type !== "character" || !actor.isOwner) {
    ui.notifications.warn(tr(
      "Owner permission for a character is required.",
      "Нужны права владельца персонажа."
    ));
    return;
  }

  if (activeLeveler) {
    if (activeLeveler.busy) {
      activeLeveler.bringToTop();
      return activeLeveler;
    }
    if (activeLeveler.actor.uuid !== actor.uuid) {
      activeLeveler.actor = actor;
      activeLeveler.refresh();
    }
    activeLeveler.render(true);
    activeLeveler.bringToTop();
    return activeLeveler;
  }

  function ask(caption, content, read, onRender) {
    return new Promise(resolve => {
      let settled = false;

      const done = value => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };

      const dialog = new Dialog({
        title: caption,
        content: `
          <div class="cp cp-mini">
            ${content}
            <div class="cp-error" data-error role="alert"></div>
            <footer>
              <button type="button" data-cancel>
                ${tr("Cancel", "Отмена")}
              </button>
              <button type="button" data-ok>
                ${tr("Confirm", "Подтвердить")}
              </button>
            </footer>
          </div>`,
        buttons: {},
        close: () => done(null),
        render: html => {
          html.find("[data-cancel]").on("click", () => dialog.close());

          html.find("[data-ok]").on("click", () => {
            try {
              const value = read(html);
              if (value !== undefined) {
                done(value);
                dialog.close();
              }
            } catch (error) {
              html.find("[data-error]").text(error.message);
            }
          });

          onRender?.(html);
        }
      }, {
        classes: ["cpr-leveler"],
        width: 580,
        resizable: true
      });

      dialog.render(true);
    });
  }

  class Leveler extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        title,
        classes: ["cpr-leveler"],
        width: Math.min(1080, window.innerWidth - 30),
        height: Math.min(800, window.innerHeight - 50),
        resizable: true
      });
    }

    constructor(actor) {
      super();
      this.actor = actor;
      this.mode = "upgrade";
      this.search = "";
      this.view = "advance";
      this.tableRate = 20;
      this.category = "all";
      this.onlySelected = false;
      this.busy = false;
      this.refresh();
    }

    signature() {
      return JSON.stringify([
        this.actor.system.improvementPoints,
        this.actor.items
          .filter(i => ["skill", "role"].includes(i.type))
          .map(i => [i.id, i.toObject().system])
      ]);
    }

    refresh() {
      this.targets = new Map();
      this.newRole = null;
      this.ip = Number(this.actor.system.improvementPoints?.value ?? 0);

      this.rows = this.actor.items
        .filter(i =>
          i.type === "role"
          || (i.type === "skill" && i.system.difficulty !== "role")
        )
        .map(i => {
          const data = i.toObject();

          return {
            id: i.id,
            data,
            base: rank(data),
            rate: rate(data),
            category: i.type === "role"
              ? "roles"
              : cats[i.system.category]
                ? i.system.category
                : "other"
          };
        });

      this.stamp = this.signature();
    }

    entries() {
      return this.rows.concat(this.newRole ? [this.newRole] : []);
    }

    target(row) {
      return this.targets.get(row.id) ?? row.base;
    }

    plan() {
      return this.entries()
        .filter(r => this.target(r) !== r.base)
        .map(r => ({
          ...r,
          to: this.target(r),
          cost: cost(r.base, this.target(r), r.rate)
        }));
    }

    total() {
      return this.plan().reduce((sum, r) => sum + r.cost, 0);
    }

    rowName(row) {
      if (row.category === "roles") {
        const name = roleNames[
          canonical(row.data.system.mainRoleAbility)
        ];
        if (name) return name[ru ? 1 : 0];
      }

      return label(itemName(row.data));
    }

    steps(row) {
      const low = Math.min(row.base, row.to);
      const high = Math.max(row.base, row.to);

      return Array.from(
        { length: high - low },
        (_, i) => `${low + i + 1}×${row.rate}`
      ).join(" + ");
    }

    setTarget(id, value) {
      if (this.busy) return;

      const row = this.entries().find(r => r.id === id);
      if (!row) return;

      const min = this.mode === "upgrade" ? row.base : 0;
      const max = this.mode === "upgrade" ? 10 : row.base;

      const to = Math.max(
        min,
        Math.min(max, Math.trunc(Number(value) || 0))
      );

      if (row.id === "new" && to === 0) this.newRole = null;

      if (to === row.base) {
        this.targets.delete(id);
      } else {
        this.targets.set(id, to);
      }

      this.paint();
    }

    get template() {
      return null;
    }

    async _renderInner() {
      return $(this.markup());
    }

    markup() {
      const roleBadges = this.rows
        .filter(r => r.category === "roles")
        .map(r => `${this.rowName(r)} ${r.base}`)
        .join(" / ");

      const value = this.rows.reduce(
        (sum, r) => sum + cost(0, r.base, r.rate),
        0
      );

      const options = owned();
      if (!options.some(a => a.uuid === this.actor.uuid)) {
        options.unshift(this.actor);
      }

      return `<div class="cp">
        <header class="cp-head">
          <img src="${esc(this.actor.img)}" alt="">

          <div class="cp-identity">
            <small class="mono">CYBERPUNK RED</small>

            <select data-actor
              aria-label="${tr("Character", "Персонаж")}">
              ${options.map(a => `
                <option value="${esc(a.uuid)}"
                  ${a.uuid === this.actor.uuid ? "selected" : ""}>
                  ${esc(a.name)}
                </option>
              `).join("")}
            </select>

            <div class="cp-status">
              <small>
                ${esc(roleBadges || tr("No role", "Нет роли"))}
              </small>

              <small>
                ${tr("Reputation", "Репутация")}:
                ${Number(this.actor.system.reputation?.value ?? 0)}
              </small>

              <small title="${tr(
                "Calculated value of current ranks, including starting ranks",
                "Расчётная стоимость текущих рангов, включая стартовые"
              )}">
                ${tr("IP Value", "Стоимость рангов")}: ${value}
              </small>
            </div>
          </div>

          <div class="cp-balance">
            <small>${tr("Available IP", "Доступно IP")}</small>
            <strong>${this.ip}</strong>
          </div>
        </header>

        <div class="cp-tab-row">
          <nav class="cp-tabs" role="tablist"
          aria-label="${tr("Advancement", "Развитие")}">
          <button type="button" role="tab"
            id="cp-tab-${this.appId}-advance"
            data-view="advance"
            aria-controls="cp-pane-${this.appId}-advance"
            aria-selected="${this.view === "advance"}"
            class="${this.view === "advance" ? "active" : ""}">
            ${tr("Advancement", "Развитие")}
          </button>

          <button type="button" role="tab"
            id="cp-tab-${this.appId}-tables"
            data-view="tables"
            aria-controls="cp-pane-${this.appId}-tables"
            aria-selected="${this.view === "tables"}"
            class="${this.view === "tables" ? "active" : ""}">
            ${tr("IP Tables", "Таблицы IP")}
          </button>
          </nav>

          <button type="button" data-mode="${this.mode === "refund" ? "upgrade" : "refund"}"
            class="cp-refund ${this.mode === "refund" ? "active" : ""}"
            aria-pressed="${this.mode === "refund"}"
            aria-label="${tr("Refund IP", "Возврат IP")}"
            title="${tr("Toggle IP refund", "Включить или выключить возврат IP")}">
            <i class="fas fa-rotate-left" aria-hidden="true"></i>
          </button>
        </div>

        <div class="cp-advance" role="tabpanel"
          id="cp-pane-${this.appId}-advance"
          aria-labelledby="cp-tab-${this.appId}-advance"
          ${this.view !== "advance" ? "hidden" : ""}>

          <div class="cp-tools">
            <button type="button" data-mode="upgrade"
              class="${this.mode === "upgrade" ? "active" : ""}">
              ${tr("Upgrade", "Повышение")}
            </button>

            <input type="search" data-search
              value="${esc(this.search)}"
              placeholder="${tr("Search skills...", "Поиск навыков...")}"
              aria-label="${tr("Search skills", "Поиск навыков")}">

            <select data-category
              aria-label="${tr("Category", "Категория")}">
              <option value="all">
                ${tr("All categories", "Все категории")}
              </option>
              ${Object.keys(cats).map(k => `
                <option value="${k}"
                  ${k === this.category ? "selected" : ""}>
                  ${catName(k)}
                </option>
              `).join("")}
            </select>

            <button type="button" data-selected
              class="${this.onlySelected ? "active" : ""}">
              ${tr("Selected", "Выбранные")}
            </button>
          </div>

          <div class="cp-work">
            <main class="cp-list" data-list></main>
            <aside class="cp-cart" data-cart aria-live="polite"></aside>
          </div>

          <footer class="cp-foot">
            <button type="button" data-clear>
              ${tr("Reset", "Сбросить")}
            </button>
            <button type="button" data-compare>
              ${tr("Compare Skills", "Сравнить навыки")}
            </button>
            <button type="button" data-close>
              ${tr("Close Dialog", "Закрыть")}
            </button>
            <button type="button" class="apply" data-apply></button>
          </footer>
        </div>

        <section class="cp-tables" role="tabpanel"
          id="cp-pane-${this.appId}-tables"
          aria-labelledby="cp-tab-${this.appId}-tables"
          ${this.view !== "tables" ? "hidden" : ""}>
          ${this.tablesHTML()}
        </section>
      </div>`;
    }

    tablesHTML() {
      return `
        <h3>${tr("One rank - IP", "Один ранг - IP")}</h3>

        <table>
          <thead>
            <tr>
              <th>${tr("Rank", "Ранг")}</th>
              <th>${tr("Standard", "Обычный")}</th>
              <th>${tr("Difficult", "Сложный")}</th>
              <th>${tr("Role", "Роль")}</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: 10 }, (_, i) => {
              const n = i + 1;
              return `
                <tr>
                  <th scope="row">${i} -&gt; ${n}</th>
                  <td>${n * 20}</td>
                  <td>${n * 40}</td>
                  <td>${n * 60}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <div class="cp-table-head">
          <h3>
            ${tr("Multiple ranks - IP", "Несколько рангов - IP")}
          </h3>

          <select data-table-rate
            aria-label="${tr("Skill type", "Тип навыка")}">
            ${[
              [20, tr("Standard", "Обычный")],
              [40, tr("Difficult", "Сложный")],
              [60, tr("Role", "Роль")]
            ].map(([value, name]) => `
              <option value="${value}"
                ${this.tableRate === value ? "selected" : ""}>
                ${name}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="cp-matrix" data-matrix>
          ${this.matrixHTML()}
        </div>
      `;
    }

    matrixHTML() {
      const targets = Array.from({ length: 10 }, (_, i) => i + 1);

      return `
        <table>
          <thead>
            <tr>
              <th>${tr("From / To", "С / До")}</th>
              ${targets.map(n => `<th scope="col">${n}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: 10 }, (_, from) => `
              <tr>
                <th scope="row">${from}</th>
                ${targets.map(to => `
                  <td>
                    ${to > from ? cost(from, to, this.tableRate) : "-"}
                  </td>
                `).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    listHTML() {
      const q = this.search.toLocaleLowerCase();

      const rows = this.entries().filter(r =>
        (this.category === "all" || r.category === this.category)
        && (!this.onlySelected || this.target(r) !== r.base)
        && matchesName(q, r.data.name, itemName(r.data), this.rowName(r),
          r.data.system.mainRoleAbility)
      );

      return Object.keys(cats).map(category => {
        const group = rows
          .filter(r => r.category === category)
          .sort((a, b) => this.rowName(a).localeCompare(
            this.rowName(b),
            ru ? "ru" : "en"
          ));

        if (
          !group.length
          && (category !== "roles" || q || this.onlySelected)
        ) return "";

        if (
          category === "roles"
          && this.category !== "all"
          && this.category !== "roles"
        ) return "";

        return `
          <section class="cp-section">
            <h3>
              <i class="fas fa-${cats[category][2]}"></i>
              ${catName(category)}
            </h3>

            ${group.map(r => this.rowHTML(r)).join("")}

            ${
              category === "roles"
              && this.mode === "upgrade"
              && !this.newRole
                ? `<button type="button" data-add style="margin:10px 0">
                    + ${tr("Add Role", "Добавить роль")}
                  </button>`
                : ""
            }
          </section>
        `;
      }).join("") || `
        <p class="cp-note">
          ${tr("No matching skills.", "Навыки не найдены.")}
        </p>
      `;
    }

    rowHTML(row) {
      const to = this.target(row);
      const changed = to !== row.base;
      const refund = this.mode === "refund";
      const min = refund ? 0 : row.base;
      const max = refund ? row.base : 10;
      const next = refund ? to * row.rate : (to + 1) * row.rate;

      const ability = row.category === "roles"
        ? label(row.data.system.mainRoleAbility)
        : `${String(row.data.system.stat ?? "").toUpperCase()}
          · ${row.rate === 40 ? "×2" : "×1"}`;

      return `
        <article class="cp-row ${changed ? "chosen" : ""}"
          data-id="${row.id}">
          <div>
            <div class="cp-name">
              <strong>${esc(this.rowName(row))}</strong>

              ${row.id !== "new" ? `
                <button type="button" data-info="${row.id}"
                  title="${tr("Open item sheet", "Открыть лист предмета")}">
                  <i class="fas fa-circle-info"></i>
                </button>
              ` : ""}
            </div>

            <div class="cp-meta">
              ${esc(ability)} · ${tr("Rank", "Ранг")}
              <b>${row.base}${changed ? ` -&gt; ${to}` : ""}</b>
            </div>

            <div class="cp-pips">
              ${Array.from({ length: 10 }, (_, i) => `
                <span class="${
                  i < Math.min(row.base, to)
                    ? "filled"
                    : i < to
                      ? "planned"
                      : i < row.base
                        ? "removed"
                        : ""
                }"></span>
              `).join("")}
            </div>
          </div>

          <div class="cp-stepper">
            <button type="button" data-step="-1"
              ${to <= min ? "disabled" : ""}
              aria-label="${tr("Decrease rank", "Уменьшить ранг")}">
              -
            </button>

            <input type="number" data-target
              min="${min}" max="${max}" step="1" value="${to}"
              aria-label="${esc(
                tr("Target rank: ", "Целевой ранг: ") + this.rowName(row)
              )}">

            <button type="button" data-step="1"
              ${to >= max ? "disabled" : ""}
              aria-label="${tr("Increase rank", "Увеличить ранг")}">
              +
            </button>
          </div>

          <div class="cp-price">
            <strong>
              ${changed ? cost(row.base, to, row.rate) : 0} IP
            </strong>
            <small>
              ${refund
                ? to > 0
                  ? `${tr("Next refund", "След. возврат")}: ${next}`
                  : tr("Minimum rank", "Минимум")
                : to < 10
                  ? `${tr("Next rank", "След. ранг")}: ${next}`
                  : tr("Max Level", "Максимум")
              }
            </small>
          </div>
        </article>
      `;
    }

    cartHTML() {
      const plan = this.plan();
      const total = this.total();
      const refund = this.mode === "refund";
      const left = this.ip + (refund ? total : -total);

      return `
        <h3>
          ${tr("Selected", "Выбрано")}
          <small class="mono">[${plan.length}]</small>
        </h3>

        ${plan.map(r => `
          <div class="cp-cart-row">
            <button type="button" data-remove="${r.id}"
              aria-label="${tr("Remove", "Убрать")}">×</button>

            <b>${esc(this.rowName(r))}</b>

            <div class="cp-equation">
              ${r.base} -&gt; ${r.to} · ${r.cost} IP
              <br>
              ${this.steps(r)} = ${r.cost}
            </div>
          </div>
        `).join("") || `
          <p class="cp-note">
            ${tr("No skills selected.", "Навыки не выбраны.")}
          </p>
        `}

        <div class="cp-total">
          <span>
            ${refund
              ? tr("Total Refund", "Всего к возврату")
              : tr("Total Cost", "Общая стоимость")
            }
          </span>
          <strong>${total} IP</strong>

          <span>${tr("Remaining", "Останется")}</span>
          <strong>${left} IP</strong>
        </div>

        ${left < 0 ? `
          <p class="cp-error">
            ${tr("Missing", "Не хватает")}: ${-left} IP
          </p>
        ` : ""}
      `;
    }

    paint() {
      const html = this.element;
      const list = html.find("[data-list]")[0];
      const scroll = list?.scrollTop ?? 0;
      const active = document.activeElement;

      const focused = list?.contains(active) ? {
        id: active.closest("[data-id]")?.dataset.id,
        selector: active.matches("[data-step]")
          ? `[data-step="${active.dataset.step}"]`
          : "[data-target]"
      } : null;

      html.find("[data-list]").html(this.listHTML());
      if (list) list.scrollTop = scroll;

      if (focused?.id) {
        html.find(
          `[data-id="${focused.id}"] ${focused.selector}`
        ).trigger("focus");
      }

      html.find("[data-cart]").html(this.cartHTML());

      html.find("[data-apply]")
        .text(this.busy
          ? tr("Saving...", "Сохранение...")
          : this.mode === "refund"
            ? tr("Confirm Refund", "Подтвердить возврат")
            : tr("Confirm Level Up", "Подтвердить повышение")
        )
        .prop("disabled",
          this.busy
          || !this.plan().length
          || (this.mode === "upgrade" && this.total() > this.ip)
        );

      if (this.busy) {
        html.find("button,input,select").prop("disabled", true);
      }
    }

    activateListeners(html) {
      super.activateListeners(html);
      this.paint();

      html.find("[data-view]").on("click", e => {
        if (this.busy || this.view === e.currentTarget.dataset.view) return;
        this.view = e.currentTarget.dataset.view;
        this.render(false);
      });

      html.find("[data-table-rate]").on("change", e => {
        this.tableRate = Number(e.currentTarget.value);
        html.find("[data-matrix]").html(this.matrixHTML());
      });

      html.on("click", "[data-step]", e => {
        const id = e.currentTarget.closest("[data-id]").dataset.id;
        const row = this.entries().find(r => r.id === id);
        this.setTarget(
          row.id,
          this.target(row) + Number(e.currentTarget.dataset.step)
        );
      });

      html.on("change", "[data-target]", e => {
        this.setTarget(
          e.currentTarget.closest("[data-id]").dataset.id,
          e.currentTarget.value
        );
      });

      html.on("click", "[data-remove]", e => {
        const id = e.currentTarget.dataset.remove;
        this.setTarget(id, this.entries().find(r => r.id === id).base);
      });

      html.on("click", "[data-info]", e => {
        this.actor.items.get(e.currentTarget.dataset.info)?.sheet.render(true);
      });

      html.on("click", "[data-add]", () => this.addRole());

      html.find("[data-search]").on("input", e => {
        this.search = e.currentTarget.value.trim();
        this.paint();
      });

      html.find("[data-category]").on("change", e => {
        this.category = e.currentTarget.value;
        this.paint();
      });

      html.find("[data-selected]").on("click", e => {
        this.onlySelected = !this.onlySelected;
        $(e.currentTarget).toggleClass("active", this.onlySelected);
        this.paint();
      });

      html.find("[data-mode]").on("click", e => {
        if (this.busy || this.mode === e.currentTarget.dataset.mode) return;
        this.mode = e.currentTarget.dataset.mode;
        this.view = "advance";
        this.targets.clear();
        this.newRole = null;
        this.render(false);
      });

      html.find("[data-clear]").on("click", () => {
        this.refresh();
        this.render(false);
      });

      html.find("[data-close]").on("click", () => this.close());
      html.find("[data-compare]").on("click", () => this.compare());

      html.find("[data-actor]").on("change", async e => {
        const actor = await fromUuid(e.currentTarget.value);
        if (actor?.isOwner) {
          this.actor = actor;
          this.refresh();
          this.render(false);
        }
      });

      html.find("[data-apply]").on("click", () => this.apply());
    }

    async addRole() {
      if (this.busy) return;

      const roles = this.rows.filter(r => r.category === "roles");

      if (roles.some(r => this.target(r) < 4)) {
        return ui.notifications.warn(tr(
          "All existing roles must reach Rank 4 before adding another role.",
          "Перед добавлением новой роли все текущие роли должны достичь ранга 4."
        ));
      }

      const pack = game.packs.get("cyberpunk-red-core.core_roles");

      if (!pack) {
        return ui.notifications.error(tr(
          "Roles compendium not found.",
          "Не найден компендиум ролей."
        ));
      }

      this.busy = true;
      this.paint();

      try {
        const docs = (await pack.getDocuments()).filter(i =>
          i.type === "role"
          && !roles.some(r =>
            canonical(r.data.system.mainRoleAbility)
            === canonical(i.system.mainRoleAbility)
          )
        );

        if (!docs.length) {
          return ui.notifications.info(tr(
            "No new roles available.",
            "Нет доступных новых ролей."
          ));
        }

        const id = await ask(
          tr("Select New Role", "Выберите новую роль"),
          `
            <p>
              ${tr(
                "Role starts at Rank 1, costing 60 IP.",
                "Новая роль начинается с ранга 1 и стоит 60 IP."
              )}
            </p>
            <select data-role>
              ${docs.map(d => `
                <option value="${d.id}">
                  ${esc(
                    roleNames[
                      canonical(d.system.mainRoleAbility)
                    ]?.[ru ? 1 : 0] ?? label(d.name)
                  )}
                </option>
              `).join("")}
            </select>
          `,
          html => html.find("[data-role]").val()
        );

        if (!id) return;

        const data = docs.find(d => d.id === id).toObject();
        delete data._id;
        data.system.rank = 0;

        const roleTitle = roleNames[
          canonical(data.system.mainRoleAbility)
        ];

        if (roleTitle) data.name = roleTitle[ru ? 1 : 0];

        data.system.abilities?.forEach(a => {
          a.rank = 0;
        });

        this.newRole = {
          id: "new",
          data,
          base: 0,
          rate: 60,
          category: "roles"
        };

        this.targets.set("new", 1);
        this.category = "all";
        this.search = "";
        this.onlySelected = false;
      } catch (error) {
        console.error(error);
        ui.notifications.error(error.message);
      } finally {
        this.busy = false;
        this.render(false);
      }
    }

    async allocate(row) {
      const data = clone(row.data);
      const main = canonical(data.system.mainRoleAbility);
      const abilities = data.system.abilities ?? [];

      if (main === "Operator") {
        const haggle = abilities.find(a => canonical(a.name) === "Haggle");
        if (haggle) haggle.rank = row.to;
      }

      if (!["Maker", "Medicine", "Combat Awareness"].includes(main)) {
        return abilities;
      }

      const medicine = [
        "Surgery",
        "Medical Tech (Pharmaceuticals)",
        "Medical Tech (Cryosystem Operation)"
      ];

      const indexes = abilities
        .map((a, i) => i)
        .filter(i =>
          main !== "Medicine"
          || medicine.includes(canonical(abilities[i].name))
        );

      if (!indexes.length) {
        throw new Error(tr(
          "Role specialties are missing.",
          "В роли отсутствуют специализации."
        ));
      }

      const weight = a => ["Medicine", "Maker"].includes(main)
        ? 1
        : Number(a.multiplier ?? 1);

      const budget = row.to * (main === "Maker" ? 2 : 1);

      const content = `
        <h3>
          ${esc(this.rowName(row))}: ${row.base} -&gt; ${row.to}
        </h3>

        <p>${tr("Points", "Очки")}: <b>${budget}</b></p>

        ${main === "Medicine" ? `
          <p class="cp-note">
            ${tr(
              "Surgery ×2. Medical Tech = Pharma + Cryo.",
              "Хирургия ×2. Медтехника = Фармацевтика + Крио."
            )}
          </p>
        ` : ""}

        ${indexes.map(i => `
          <label class="alloc">
            <span>
              ${esc(label(abilities[i].name))}
              ${weight(abilities[i]) !== 1
                ? `<small>(×${weight(abilities[i])})</small>`
                : ""}
            </span>
            <input type="number" data-alloc="${i}" min="0"
              max="${
                main === "Medicine"
                && canonical(abilities[i].name) === "Surgery"
                  ? 5
                  : 10
              }"
              step="1" value="${abilities[i].rank}">
          </label>
        `).join("")}

        <p class="mono" data-budget></p>
      `;

      const readValues = html => indexes.map(i =>
        Number(html.find(`[data-alloc="${i}"]`).val())
      );

      return ask(
        tr("Allocate Points", "Распределение очков"),
        content,
        html => {
          const values = readValues(html);

          if (values.some((n, j) =>
            !Number.isInteger(n)
            || n < 0
            || n > (
              main === "Medicine"
              && canonical(abilities[indexes[j]].name) === "Surgery"
                ? 5
                : 10
            )
          )) {
            throw new Error(tr(
              "Enter valid whole-number ranks.",
              "Введите целые ранги в допустимых пределах."
            ));
          }

          const sum = values.reduce(
            (s, n, j) => s + n * weight(abilities[indexes[j]]),
            0
          );

          if (Math.abs(sum - budget) > 0.001) {
            throw new Error(
              `${tr("Allocated", "Распределено")}: ${sum} / ${budget}`
            );
          }

          indexes.forEach((i, j) => {
            abilities[i].rank = values[j];
          });

          if (main === "Medicine") {
            const get = name => abilities.find(
              a => canonical(a.name) === name
            )?.rank ?? 0;

            for (const ability of abilities) {
              const key = canonical(ability.name);

              if (key === "Surgery Skill") {
                ability.rank = 2 * get("Surgery");
              }

              if (["Medical Tech Skill", "Medical Tech"].includes(key)) {
                ability.rank =
                  get("Medical Tech (Pharmaceuticals)")
                  + get("Medical Tech (Cryosystem Operation)");
              }
            }
          }

          return abilities;
        },
        html => {
          const update = () => {
            const sum = readValues(html).reduce(
              (s, n, j) => s + n * weight(abilities[indexes[j]]),
              0
            );

            html.find("[data-budget]").text(
              `${tr("Allocated", "Распределено")}: ${sum} / ${budget}`
            );
          };

          html.find("[data-alloc]").on("input", update);
          update();
        }
      );
    }

    async apply() {
      if (this.busy || !this.actor.isOwner) return;

      const plan = this.plan();
      const refund = this.mode === "refund";
      const total = this.total();

      if (!plan.length || (!refund && total > this.ip)) return;

      this.busy = true;
      this.paint();

      try {
        const assertFresh = () => {
          if (this.signature() !== this.stamp) {
            throw new Error(tr(
              "Character data changed. Reset the plan and try again.",
              "Данные персонажа изменились. Сбросьте план и повторите выбор."
            ));
          }

          if (!this.actor.isOwner) {
            throw new Error(tr(
              "Owner permission required.",
              "Нужны права владельца."
            ));
          }
        };

        assertFresh();

        if (
          this.newRole
          && this.rows.some(r =>
            r.category === "roles" && this.target(r) < 4
          )
        ) {
          throw new Error(tr(
            "Existing roles must reach Rank 4.",
            "Текущие роли должны достичь ранга 4."
          ));
        }

        const confirmed = await ask(
          refund ? tr("Confirm Refund", "Подтвердите возврат") : title,
          `
            <table>
              <thead>
                <tr>
                  <th>${tr("Skill / Role", "Навык / Роль")}</th>
                  <th>${tr("Rank", "Ранг")}</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                ${plan.map(r => `
                  <tr>
                    <td>${esc(this.rowName(r))}</td>
                    <td>${r.base} -&gt; ${r.to}</td>
                    <td>${r.cost}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <p>
              <b>${tr("Total", "Всего")}: ${total} IP</b>
              · ${tr("Remaining", "Останется")}:
              ${this.ip + (refund ? total : -total)} IP
            </p>
          `,
          () => true
        );

        if (!confirmed) return;

        const updates = [];
        const restore = [];

        for (const row of plan) {
          const path = row.category === "roles"
            ? "system.rank"
            : "system.level";

          const update = {
            _id: row.id,
            [path]: row.to
          };

          if (row.category === "roles") {
            const abilities = await this.allocate(row);
            if (abilities === null) return;
            update["system.abilities"] = abilities;
          }

          updates.push(update);

          if (row.id !== "new") {
            restore.push({
              _id: row.id,
              [path]: row.base,
              ...(row.category === "roles" ? {
                "system.abilities": clone(row.data.system.abilities)
              } : {})
            });
          }
        }

        assertFresh();

        const delta = refund ? total : -total;
        const after = this.ip + delta;

        const reason = plan.map(r =>
          `${this.rowName(r)} ${r.base}->${r.to}`
        ).join("; ");

        const ledger = clone(
          this.actor.system.improvementPoints.transactions ?? []
        );

        ledger.push([
          game.i18n.format(
            delta > 0
              ? "CPR.ledger.increaseSentence"
              : "CPR.ledger.decreaseSentence",
            {
              property: "improvementPoints",
              amount: total,
              total: after
            }
          ),
          reason
        ]);

        let created = [];
        let itemsWritten = false;

        try {
          const existing = updates.filter(u => u._id !== "new");

          if (existing.length) {
            await this.actor.updateEmbeddedDocuments("Item", existing);
            itemsWritten = true;
          }

          const added = updates.find(u => u._id === "new");

          if (added) {
            const data = clone(this.newRole.data);
            data.system.rank = added["system.rank"];
            data.system.abilities = added["system.abilities"];

            created = await this.actor.createEmbeddedDocuments(
              "Item",
              [data]
            );

            if (!created.length) {
              throw new Error(tr(
                "Role could not be created.",
                "Не удалось создать роль."
              ));
            }
          }

          await this.actor.update({
            "system.improvementPoints.value": after,
            "system.improvementPoints.transactions": ledger
          });
        } catch (error) {
          try {
            if (created.length) {
              await this.actor.deleteEmbeddedDocuments(
                "Item",
                created.map(i => i.id)
              );
            }

            if (itemsWritten) {
              await this.actor.updateEmbeddedDocuments("Item", restore);
            }
          } catch (rollbackError) {
            console.error("CPR rollback", rollbackError);
            ui.notifications.error(tr(
              "Rollback failed. Check character ranks and IP.",
              "Откат не выполнен. Проверьте ранги и IP персонажа."
            ));
          }

          throw error;
        }

        this.refresh();
        ui.notifications.info(tr(
          "Character updated.",
          "Персонаж обновлён."
        ));

        try {
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `
              <p>
                <b>${esc(this.actor.name)}</b>
                · ${refund
                  ? tr("Refund IP", "Возврат IP")
                  : tr(
                    "Character Level Up",
                    "Повышение уровня персонажа"
                  )
                }
              </p>
              <ul>
                ${plan.map(r => `
                  <li>
                    ${esc(this.rowName(r))}:
                    ${r.base} -&gt; ${r.to} (${r.cost} IP)
                  </li>
                `).join("")}
              </ul>
              <p>
                <b>${tr("Total", "Всего")}: ${total} IP</b>
                · ${tr("Remaining", "Остаток")}: ${after} IP
              </p>
            `
          });
        } catch (error) {
          console.error(error);
          ui.notifications.warn(tr(
            "Saved, but the chat report failed.",
            "Изменения сохранены, но отчёт в чат не отправлен."
          ));
        }
      } catch (error) {
        console.error("CPR advancement", error);
        ui.notifications.error(error.message);
      } finally {
        this.busy = false;
        this.render(false);
      }
    }

    async compare() {
      const actors = game.actors.filter(a =>
        a.type === "character"
        && a.hasPlayerOwner
        && a.testUserPermission(game.user, "OBSERVER")
      );

      if (!actors.some(a => a.uuid === this.actor.uuid)) {
        actors.unshift(this.actor);
      }

      const skills = this.rows.filter(
        r => r.category !== "roles" && r.base > 0
      );

      await ask(
        tr("Compare Skills", "Сравнить навыки"),
        `
          <table>
            <thead>
              <tr>
                <th>${tr("Skill", "Навык")}</th>
                ${actors.map(a => `<th>${esc(a.name)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${skills.map(r => `
                <tr>
                  <td>${esc(this.rowName(r))}</td>
                  ${actors.map(a => {
                    const item = a.items.find(i =>
                      i.type === "skill"
                      && canonical(itemName(i))
                      === canonical(itemName(r.data))
                    );
                    return `<td class="mono">${item ? rank(item) : "-"}</td>`;
                  }).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        `,
        () => true
      );
    }

    async close(options) {
      if (this.busy) return;
      const result = await super.close(options);
      if (activeLeveler === this) activeLeveler = null;
      return result;
    }
  }

  activeLeveler = new Leveler(actor);
  activeLeveler.render(true);
  return activeLeveler;
}
