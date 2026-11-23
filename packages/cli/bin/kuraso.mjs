#!/usr/bin/env node
/**
 * Kuraso CLI — operate directly on any file-based Kuraso library folder.
 *
 * Commands:
 *   kuraso status <library-dir>
 *   kuraso search <library-dir> <query>
 *   kuraso export-bib <library-dir>
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { exportCollectionToBibtex } from "../../exporters/src/bibtex.mjs";

export function loadLibraryPapersFromDisk(libraryDir) {
  const papersRoot = resolve(libraryDir, "papers");
  if (!existsSync(papersRoot)) return [];
  const entries = readdirSync(papersRoot, { withFileTypes: true });
  const papers = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = resolve(papersRoot, entry.name, "meta.json");
    if (!existsSync(metaPath)) continue;
    try {
      papers.push(JSON.parse(readFileSync(metaPath, "utf8")));
    } catch {
      // Skip malformed entries.
    }
  }
  return papers;
}

export function runCli(args) {
  const [cmd, libDir, ...rest] = args;
  if (!cmd || !libDir) {
    return "Usage: kuraso <status|search|export-bib> <library-dir> [query]";
  }
  const papers = loadLibraryPapersFromDisk(libDir);

  if (cmd === "status") {
    return `Kuraso library at ${resolve(libDir)}: ${papers.length} paper(s).`;
  }

  if (cmd === "search") {
    const query = rest.join(" ").trim().toLowerCase();
    const hits = papers.filter((p) =>
      [p.title, p.venue ?? "", p.doi ?? "", ...(p.tags ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
    if (hits.length === 0) return `No papers matching "${query}".`;
    return hits.map((p) => `- [${p.year ?? "n.d."}] ${p.title} (${p.slug})`).join("\n");
  }

  if (cmd === "export-bib") {
    return exportCollectionToBibtex(papers);
  }

  return `Unknown command: ${cmd}`;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  console.log(runCli(process.argv.slice(2)));
}
