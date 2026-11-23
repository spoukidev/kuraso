import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../bin/kuraso.mjs";

describe("@kuraso/cli v2.0", () => {
  it("inspects status, searches papers, and exports BibTeX directly from disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "kuraso-cli-"));
    try {
      const slugDir = join(dir, "papers", "2024-benali-ids-abc123");
      mkdirSync(slugDir, { recursive: true });
      writeFileSync(
        join(slugDir, "meta.json"),
        JSON.stringify({
          id: "pap_abc123",
          slug: "2024-benali-ids-abc123",
          title: "Adversarial IDS for 6G",
          authors: [{ name: "Amina Benali", orcid: null }],
          year: 2024,
          venue: "IEEE S&P",
          doi: "10.1109/SP.2024.1",
          tags: ["#6G"],
        }),
      );

      assert.ok(runCli(["status", dir]).includes("1 paper(s)"));
      assert.ok(runCli(["search", dir, "6G"]).includes("Adversarial IDS for 6G"));
      assert.ok(runCli(["export-bib", dir]).includes("@article{benali2024adversarial,"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
