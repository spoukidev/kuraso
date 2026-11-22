import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getLanguageDirection, TRANSLATIONS } from "../src/i18n/translations.mjs";

describe("Kuraso v0.2 i18n & Arabic RTL", () => {
  it("resolves RTL for Arabic and LTR for English & French", () => {
    assert.equal(getLanguageDirection("ar"), "rtl");
    assert.equal(getLanguageDirection("en"), "ltr");
    assert.equal(getLanguageDirection("fr"), "ltr");
  });

  it("maintains 100% key parity across EN, FR, and AR bundles", () => {
    const enKeys = Object.keys(TRANSLATIONS.en).sort();
    const frKeys = Object.keys(TRANSLATIONS.fr).sort();
    const arKeys = Object.keys(TRANSLATIONS.ar).sort();

    assert.deepEqual(frKeys, enKeys, "FR bundle must match EN keys exactly");
    assert.deepEqual(arKeys, enKeys, "AR bundle must match EN keys exactly");

    for (const lang of ["en", "fr", "ar"]) {
      for (const key of enKeys) {
        const val = TRANSLATIONS[lang][key];
        assert.ok(typeof val === "string" && val.trim().length > 0, `Empty translation: ${lang}.${key}`);
      }
    }
  });
});
