import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DOCS_SCHEMA_URL = process.env.DOCS_SCHEMA_URL ?? "http://localhost:8002/api/schema/";
const NSI_SCHEMA_URL = process.env.NSI_SCHEMA_URL ?? "http://localhost:8001/api/schema/";

const outDir = path.resolve("src/api/generated");
fs.mkdirSync(outDir, { recursive: true });

const cli = path.resolve("node_modules/openapi-typescript/bin/cli.js");

function gen(url, outFile) {
  console.log(`Generating: ${url} -> ${outFile}`);
  execFileSync(process.execPath, [cli, url, "-o", outFile], { stdio: "inherit" });
}

gen(DOCS_SCHEMA_URL, path.join(outDir, "documents.ts"));
gen(NSI_SCHEMA_URL, path.join(outDir, "nsi.ts"));

console.log("Done.");
