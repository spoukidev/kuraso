/**
 * @kuraso/plugin-sdk — MIT-licensed plugin host & registry for Kuraso v2.0.
 */

export class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.commands = [];
    this.recipes = [];
  }

  register(plugin) {
    if (!plugin?.id || !plugin?.name) {
      throw new Error("Plugin must define id and name");
    }
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`);
    }

    const api = {
      registerCommand: (cmd) => {
        this.commands.push({ ...cmd, pluginId: plugin.id });
      },
      registerRecipe: (recipe) => {
        this.recipes.push({ ...recipe, pluginId: plugin.id });
      },
    };

    plugin.onLoad?.(api);
    this.plugins.set(plugin.id, plugin);
  }

  unregister(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    plugin.onUnload?.();
    this.plugins.delete(pluginId);
    this.commands = this.commands.filter((c) => c.pluginId !== pluginId);
    this.recipes = this.recipes.filter((r) => r.pluginId !== pluginId);
  }

  listPlugins() {
    return Array.from(this.plugins.values()).map(({ id, name, version }) => ({
      id,
      name,
      version,
    }));
  }
}
