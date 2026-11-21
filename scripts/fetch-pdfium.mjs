#!/usr/bin/env node
/**
 * Fetches prebuilt PDFium shared libraries from bblanchon/pdfium-binaries
 * into apps/desktop/src-tauri/resources/pdfium/<platform>/ for Tauri bundling.
 *
 * Usage:
 *   node scripts/fetch-pdfium.mjs          # downloads for current OS/arch
 *   node scripts/fetch-pdfium.mjs --dry-run
 */

import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const TARGET_MAP = {
  "win32-x64": {
    asset: "pdfium-win-x64.tgz",
    libName: "pdfium.dll",
  },
  "win32-arm64": {
    asset: "pdfium-win-arm64.tgz",
    libName: "pdfium.dll",
  },
  "darwin-arm64": {
    asset: "pdfium-mac-arm64.tgz",
    libName: "libpdfium.dylib",
  },
  "darwin-x64": {
    asset: "pdfium-mac-x64.tgz",
    libName: "libpdfium.dylib",
  },
  "linux-x64": {
    asset: "pdfium-linux-x64.tgz",
    libName: "libpdfium.so",
  },
  "linux-arm64": {
    asset: "pdfium-linux-arm64.tgz",
    libName: "libpdfium.so",
  },
};

const key = `${process.platform}-${process.arch}`;
const target = TARGET_MAP[key];

if (!target) {
  console.error(`Unsupported platform/arch for PDFium: ${key}`);
  process.exit(1);
}

const outDir = resolve(repoRoot, "apps/desktop/src-tauri/resources/pdfium", key);
const url = `https://github.com/bblanchon/pdfium-binaries/releases/latest/download/${target.asset}`;
const dryRun = process.argv.includes("--dry-run");

console.log(`PDFium target: ${key}`);
console.log(`Source URL:    ${url}`);
console.log(`Output dir:    ${outDir}`);
console.log(`Expected lib:  ${target.libName}`);

if (dryRun) {
  console.log("Dry run complete (no files downloaded).");
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const libPath = resolve(outDir, target.libName);
if (existsSync(libPath)) {
  console.log(`PDFium already present at ${libPath}`);
  process.exit(0);
}

console.log("Downloading PDFium archive...");
const res = await fetch(url);
if (!res.ok) {
  console.error(`Failed to download ${url}: HTTP ${res.status}`);
  process.exit(1);
}

const { execFileSync } = await import("node:child_process");
const { writeFileSync, unlinkSync } = await import("node:fs");
const archivePath = resolve(outDir, target.asset);
writeFileSync(archivePath, Buffer.from(await res.arrayBuffer()));
execFileSync("tar", ["-xzf", archivePath, "-C", outDir]);
unlinkSync(archivePath);
console.log(`PDFium extracted to ${outDir}`);
