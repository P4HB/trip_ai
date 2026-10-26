import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const readJSON = file => JSON.parse(fs.readFileSync(file, "utf8"));
export const readJsonLines = file => fs.readFileSync(file, "utf8").split(/\r?\n/u).filter(line => line.trim()).map(line => JSON.parse(line));
export const activeDatasets = readJSON(path.join(workspaceRoot, "config/active_datasets.json"));
export function activePath(key) {
  const relative = activeDatasets[key];
  if (typeof relative !== "string") throw new Error(`Unknown dataset: ${key}`);
  const resolved = path.resolve(workspaceRoot, relative);
  if (!resolved.startsWith(workspaceRoot + path.sep)) throw new Error(`Dataset outside workspace: ${key}`);
  return resolved;
}
export const sha256Hex = value => createHash("sha256").update(value).digest("hex");
