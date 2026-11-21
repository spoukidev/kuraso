export type KurasoTheme = "light" | "sepia" | "dark";

export const SEMANTIC_HIGHLIGHT_DEFAULTS = {
  yellow: { label: "key-idea", cssBg: "var(--kuraso-hl-yellow-bg)", cssBorder: "var(--kuraso-hl-yellow-border)" },
  green: { label: "method", cssBg: "var(--kuraso-hl-green-bg)", cssBorder: "var(--kuraso-hl-green-border)" },
  blue: { label: "result", cssBg: "var(--kuraso-hl-blue-bg)", cssBorder: "var(--kuraso-hl-blue-border)" },
  red: { label: "limitation", cssBg: "var(--kuraso-hl-red-bg)", cssBorder: "var(--kuraso-hl-red-border)" },
  purple: { label: "to-cite", cssBg: "var(--kuraso-hl-purple-bg)", cssBorder: "var(--kuraso-hl-purple-border)" },
} as const;
