import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DOCS_SCHEMA_URL = process.env.DOCS_SCHEMA_URL ?? "http://localhost:8002/api/schema/";
const NSI_SCHEMA_URL = process.env.NSI_SCHEMA_URL ?? "http://localhost:8001/api/schema/";

// Retry settings (useful when services are still starting)
const MAX_ATTEMPTS = Number(process.env.SCHEMA_FETCH_ATTEMPTS ?? "60"); // ~60s
const DELAY_MS = Number(process.env.SCHEMA_FETCH_DELAY_MS ?? "1000");

const outDir = path.resolve("src/api/generated");
const tmpDir = path.resolve(".tmp");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

const cli = path.resolve("node_modules/openapi-typescript/bin/cli.js");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitSchema(url) {
  let lastErr = null;
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) return true;
      lastErr = new Error(`HTTP ${res.status} ${await res.text()}`);
    } catch (e) {
      lastErr = e;
    }
    await sleep(DELAY_MS);
  }
  console.warn(`[gen] schema is not reachable: ${url}`);
  if (lastErr) console.warn(`[gen] last error: ${String(lastErr)}`);
  return false;
}

async function fetchToFile(url, filePath) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Schema fetch failed: ${res.status} ${await res.text()}`);
  const txt = await res.text();
  fs.writeFileSync(filePath, txt, "utf-8");
}

function runOpenapiTypescript(inputFile, outFile) {
  execFileSync(process.execPath, [cli, inputFile, "-o", outFile], { stdio: "inherit" });
}

async function genOne(url, outFile, label) {
  const ok = await waitSchema(url);
  if (!ok) {
    console.warn(`[gen] skip ${label} (keeping existing generated file)`);
    return;
  }

  const schemaFile = path.join(tmpDir, `${label}-schema.json`);
  try {
    console.log(`Prefetch schema: ${url} -> ${schemaFile}`);
    await fetchToFile(url, schemaFile);

    console.log(`Generate: ${schemaFile} -> ${outFile}`);
    runOpenapiTypescript(schemaFile, outFile);
  } catch (e) {
    console.warn(`[gen] failed to generate ${label}: ${String(e)}`);
    // do not fail the whole dev run
  }
}

await genOne(DOCS_SCHEMA_URL, path.join(outDir, "documents.ts"), "documents");
await genOne(NSI_SCHEMA_URL, path.join(outDir, "nsi.ts"), "nsi");

console.log("Done.");
