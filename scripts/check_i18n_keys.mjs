// CI gate: frontend/src/i18n/uk.json and en.json must keep identical key
// sets (AGENTS.md convention). Run from the repo root: node scripts/check_i18n_keys.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const i18nDir = join(dirname(fileURLToPath(import.meta.url)), "..", "frontend", "src", "i18n");

function flattenKeys(obj, prefix = "") {
  // Arrays recurse with index segments (i18next exposes a.0, a.1, ...), so a
  // length mismatch between locales fails the parity check.
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object"
      ? [path, ...flattenKeys(value, path)]
      : [path];
  });
}

const locales = ["uk", "en"].map((lang) => ({
  lang,
  keys: new Set(flattenKeys(JSON.parse(readFileSync(join(i18nDir, `${lang}.json`), "utf8")))),
}));

const [uk, en] = locales;
const missingInEn = [...uk.keys].filter((k) => !en.keys.has(k));
const missingInUk = [...en.keys].filter((k) => !uk.keys.has(k));

if (missingInEn.length || missingInUk.length) {
  for (const key of missingInEn) console.error(`missing in en.json: ${key}`);
  for (const key of missingInUk) console.error(`missing in uk.json: ${key}`);
  process.exit(1);
}
console.log(`i18n key sets identical (${uk.keys.size} keys)`);
