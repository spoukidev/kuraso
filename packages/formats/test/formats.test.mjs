import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const SCHEMA_FILES = [
  "kuraso-library.schema.json",
  "collections.schema.json",
  "meta.schema.json",
  "structure.schema.json",
  "annotations.schema.json",
];

describe("@kuraso/formats JSON schemas", () => {
  for (const file of SCHEMA_FILES) {
    it(`parses ${file} as valid JSON Schema draft 2020-12`, () => {
      const raw = readFileSync(resolve(rootDir, "schemas", file), "utf8");
      const schema = JSON.parse(raw);
      assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
      assert.ok(schema.$id.startsWith("https://kuraso.org/schemas/"));
      assert.equal(schema.type, "object");
      assert.ok(Array.isArray(schema.required));
    });
  }

  it("locks coordinateSpace consistently in structure and annotations schemas", () => {
    const structure = JSON.parse(
      readFileSync(resolve(rootDir, "schemas/structure.schema.json"), "utf8"),
    );
    const annotations = JSON.parse(
      readFileSync(resolve(rootDir, "schemas/annotations.schema.json"), "utf8"),
    );
    assert.equal(
      structure.properties.coordinateSpace.const,
      "pdf-cropbox-points-bl-unrotated",
    );
    assert.equal(
      annotations.properties.coordinateSpace.const,
      "pdf-cropbox-points-bl-unrotated",
    );
    assert.ok(structure.required.includes("parserVersion"));
  });
});

describe("@kuraso/formats providers.json", () => {
  it("lists free-tier no-credit-card providers first", () => {
    const data = JSON.parse(readFileSync(resolve(rootDir, "providers.json"), "utf8"));
    assert.equal(data.version, 1);
    assert.ok(Array.isArray(data.providers) && data.providers.length >= 5);

    const firstThree = data.providers.slice(0, 3);
    for (const p of firstThree) {
      assert.equal(p.freeTier, true, `Expected ${p.id} to be freeTier`);
      assert.equal(p.needsCard, false, `Expected ${p.id} to require no credit card`);
      assert.match(p.lastChecked, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("uses only v0.1 supported adapter kinds", () => {
    const data = JSON.parse(readFileSync(resolve(rootDir, "providers.json"), "utf8"));
    const allowed = new Set(["openai-compatible", "anthropic", "ollama"]);
    for (const p of data.providers) {
      assert.ok(allowed.has(p.kind), `Unexpected adapter kind ${p.kind} for ${p.id}`);
    }
  });
});
