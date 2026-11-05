// Downloads Cal.diy's OpenAPI spec at a given commit, records it in openapi/SOURCE.json and regenerates.
//   bun scripts/sync-openapi.ts            re-download the pinned commit
//   bun scripts/sync-openapi.ts <sha>      move the pin to another calcom/cal.diy commit (full 40-char SHA)
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const SPEC_FILE = new URL("../openapi/cal-diy-api-v2.json", import.meta.url);
const SOURCE_FILE = new URL("../openapi/SOURCE.json", import.meta.url);

type SourceInfo = {
  repository: string;
  commit: string;
  path: string;
  license: string;
  sha256: string;
};

const source = JSON.parse(await readFile(SOURCE_FILE, "utf8")) as SourceInfo;
const commit = process.argv[2] ?? source.commit;

// A full SHA keeps the pin immutable; branch names or short SHAs could silently change what is downloaded.
if (!/^[0-9a-f]{40}$/.test(commit)) {
  throw new Error(`Expected a full 40-character commit SHA from ${source.repository}, got "${commit}".`);
}

const url = `https://raw.githubusercontent.com/${source.repository}/${commit}/${source.path}`;
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Could not download the spec (${response.status} ${response.statusText}) from ${url}`);
}

const specText = await response.text();
JSON.parse(specText);
const sha256 = createHash("sha256").update(specText).digest("hex");

await writeFile(SPEC_FILE, specText);
await writeFile(SOURCE_FILE, `${JSON.stringify({ ...source, commit, sha256 }, null, 2)}\n`);
console.log(
  `Saved the spec from ${source.repository}@${commit.slice(0, 7)} (sha256 ${sha256.slice(0, 12)}…).`
);

const generate = Bun.spawnSync(["bun", "scripts/generate.ts"], {
  cwd: new URL("..", import.meta.url).pathname,
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(generate.exitCode);
