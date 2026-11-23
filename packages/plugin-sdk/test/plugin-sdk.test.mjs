import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PluginRegistry } from "../src/registry.mjs";

describe("@kuraso/plugin-sdk v2.0", () => {
  it("registers and unregisters plugins, commands, and custom AI recipes cleanly", () => {
    const registry = new PluginRegistry();
    let unloaded = false;

    registry.register({
      id: "com.example.biomed",
      name: "Biomed Triage",
      version: "1.0.0",
      onLoad(api) {
        api.registerCommand({ id: "biomed:check", label: "Check PubMed", run: () => {} });
        api.registerRecipe({
          id: "biomed-pico",
          name: "PICO Summary",
          promptTemplate: "Summarize Population, Intervention, Comparison, Outcome with [P#].",
        });
      },
      onUnload() {
        unloaded = true;
      },
    });

    assert.equal(registry.listPlugins().length, 1);
    assert.equal(registry.commands.length, 1);
    assert.equal(registry.recipes.length, 1);

    registry.unregister("com.example.biomed");
    assert.equal(unloaded, true);
    assert.equal(registry.listPlugins().length, 0);
    assert.equal(registry.commands.length, 0);
    assert.equal(registry.recipes.length, 0);
  });
});
