import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { test } from "node:test";

test("manifest identifies the module and references existing release resources", async () => {
  const root = new URL("../", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("module.json", root), "utf8"));
  const project = "https://github.com/Frost-Jack/cyberpunk-red-improvement-module";
  assert.equal(manifest.id, "cyberpunk-red-improvement-module");
  assert.equal(manifest.url, project);
  assert.equal(manifest.relationships.systems[0].id, "cyberpunk-red-core");
  assert.equal(manifest.compatibility.minimum, "12");
  assert.equal(manifest.compatibility.maximum, "12");
  assert.doesNotMatch(JSON.stringify(manifest), /#\{|New Module|discordID/);
  for (const path of [...manifest.esmodules, ...manifest.styles, manifest.readme, manifest.license]) {
    await access(new URL(path, root));
  }
  const locales = [];
  for (const language of manifest.languages) {
    locales.push(JSON.parse(await readFile(new URL(language.path, root), "utf8")));
  }
  assert.deepEqual(manifest.languages.map(language => language.lang), ["en", "ru"]);
  assert.deepEqual(Object.keys(locales[0]), Object.keys(locales[1]));
});
