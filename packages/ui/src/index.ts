export type KurasoTheme = "light" | "sepia" | "dark";

/**
 * The five semantic highlights. They are also Kuraso's brand palette ("markers").
 * - cssBg / cssBorder: the translucent wash and its 3:1 edge (theme-aware)
 * - cssMarker: the solid marker fill used for dots, label tags and stickers (text on it is always ink)
 * - key: keyboard shortcut shown on every dot so colour is never the only cue
 */
export const SEMANTIC_HIGHLIGHT_DEFAULTS = {
  yellow: {
    label: "key-idea",
    key: 1,
    cssBg: "var(--kuraso-hl-yellow-bg)",
    cssBorder: "var(--kuraso-hl-yellow-border)",
    cssMarker: "var(--kuraso-marker)",
  },
  green: {
    label: "method",
    key: 2,
    cssBg: "var(--kuraso-hl-green-bg)",
    cssBorder: "var(--kuraso-hl-green-border)",
    cssMarker: "var(--kuraso-mint)",
  },
  blue: {
    label: "result",
    key: 3,
    cssBg: "var(--kuraso-hl-blue-bg)",
    cssBorder: "var(--kuraso-hl-blue-border)",
    cssMarker: "var(--kuraso-sky)",
  },
  red: {
    label: "limitation",
    key: 4,
    cssBg: "var(--kuraso-hl-red-bg)",
    cssBorder: "var(--kuraso-hl-red-border)",
    cssMarker: "var(--kuraso-coral)",
  },
  purple: {
    label: "to-cite",
    key: 5,
    cssBg: "var(--kuraso-hl-purple-bg)",
    cssBorder: "var(--kuraso-hl-purple-border)",
    cssMarker: "var(--kuraso-lilac)",
  },
} as const;
