import { openAdvancement } from "./advancement.js";
import { installBilingualSearch } from "./search.js";

const MODULE_ID = "cyberpunk-red-improvement-module";

Hooks.once("init", () => {
  if (game.system.id !== "cyberpunk-red-core") return;
  game.modules.get(MODULE_ID).api = { open: openAdvancement };
});

Hooks.once("ready", () => {
  if (game.system.id === "cyberpunk-red-core") installBilingualSearch();
});

Hooks.on("renderActorSheet", (sheet, html) => {
  if (game.system.id !== "cyberpunk-red-core") return;

  const root = html[0] ?? html;
  root.querySelectorAll(".cpr-ip-open").forEach(button => button.remove());

  const actor = sheet.actor;
  if (actor?.type !== "character" || !actor.isOwner
    || !(Number(actor.system.improvementPoints?.value) > 0)) return;

  const points = root.querySelector(".actor-details-improvement-points");
  if (!points) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "cpr-ip-open";
  button.title = game.i18n.localize("CPRIP.OpenAdvancement");
  button.setAttribute("aria-label", button.title);
  button.dataset.tooltip = button.title;
  button.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m3.5 7 4.5-4.5L12.5 7M8 3v10.5"/></svg>';
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openAdvancement(actor);
  });
  points.append(button);
});
