import type { AIRecipe, Project } from "@kuraso/formats";
import { BUILTIN_RECIPES } from "@kuraso/ai";

const PROJECTS_KEY = "kuraso:projects:v1";
const RECIPES_KEY = "kuraso:ai-recipes:v1";

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    // Ignore.
  }
}

export function createProjectRecord(name: string, description = ""): Project {
  const now = new Date().toISOString();
  return {
    id: `proj_${Math.random().toString(36).slice(2, 10)}`,
    name: name.trim(),
    description: description.trim() || null,
    collectionIds: [],
    draftMarkdown: `# ${name.trim()}\n\n## Related Work Draft\n\nUse [[Paper Title]] to link papers from your library.\n`,
    createdAt: now,
    updatedAt: now,
  };
}

export function loadRecipes(): AIRecipe[] {
  try {
    const raw = localStorage.getItem(RECIPES_KEY);
    if (!raw) return BUILTIN_RECIPES;
    const custom = JSON.parse(raw) as AIRecipe[];
    const merged = [...BUILTIN_RECIPES];
    for (const r of custom) {
      if (!merged.some((b) => b.id === r.id)) merged.push(r);
    }
    return merged;
  } catch {
    return BUILTIN_RECIPES;
  }
}

export function saveCustomRecipes(recipes: AIRecipe[]): void {
  try {
    const customOnly = recipes.filter((r) => !r.builtIn);
    localStorage.setItem(RECIPES_KEY, JSON.stringify(customOnly));
  } catch {
    // Ignore.
  }
}
