import type { AIRecipe } from "@kuraso/formats";

export interface PluginCommand {
  id: string;
  label: string;
  run: () => void;
}

export interface KurasoPluginAPI {
  registerCommand(command: PluginCommand): void;
  registerRecipe(recipe: AIRecipe): void;
}

export interface KurasoPlugin {
  id: string;
  name: string;
  version: string;
  onLoad?(api: KurasoPluginAPI): void;
  onUnload?(): void;
}

export declare class PluginRegistry {
  commands: (PluginCommand & { pluginId: string })[];
  recipes: (AIRecipe & { pluginId: string })[];
  register(plugin: KurasoPlugin): void;
  unregister(pluginId: string): void;
  listPlugins(): { id: string; name: string; version: string }[];
}
