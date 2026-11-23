#!/usr/bin/env node
/**
 * Kuraso Self-Hostable Sync Server (AGPL-3.0)
 *
 * Stores encrypted or JSON library state snapshots (metadata, collections,
 * annotations, notes — never copyrighted PDF redistribution) per libraryId.
 *
 * Environment variables:
 *   PORT=8787
 *   KURASO_SYNC_TOKEN=<required bearer token>
 *   KURASO_DATA_DIR=./data
 */

import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.KURASO_SYNC_TOKEN ?? "";
const DATA_DIR = resolve(process.env.KURASO_DATA_DIR ?? "./data");

mkdirSync(DATA_DIR, { recursive: true });

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function isAuthorized(req) {
  if (!TOKEN) return false;
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

function safeId(raw) {
  return String(raw ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, service: "kuraso-sync-server", version: "2.0.0" });
  }

  const match = url.pathname.match(/^\/v1\/libraries\/([a-zA-Z0-9_-]+)\/sync$/);
  if (!match) {
    return sendJson(res, 404, { error: "Not found" });
  }

  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const libId = safeId(match[1]);
  const snapshotPath = resolve(DATA_DIR, `${libId}.snapshot.json`);

  if (req.method === "GET") {
    if (!existsSync(snapshotPath)) {
      return sendJson(res, 200, { libraryId: libId, revision: 0, payload: null });
    }
    const raw = readFileSync(snapshotPath, "utf8");
    return sendJson(res, 200, JSON.parse(raw));
  }

  if (req.method === "PUT") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const next = {
          libraryId: libId,
          revision: Date.now(),
          updatedAt: new Date().toISOString(),
          payload: body.payload ?? null,
        };
        writeFileSync(snapshotPath, JSON.stringify(next, null, 2));
        sendJson(res, 200, { ok: true, revision: next.revision });
      } catch {
        sendJson(res, 400, { error: "Invalid JSON payload" });
      }
    });
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`Kuraso sync server listening on http://0.0.0.0:${PORT}`);
});
