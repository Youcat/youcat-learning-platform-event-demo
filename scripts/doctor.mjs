import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicationRoot = process.env.YOUCAT_PUBLICATION_PATH
  || "/Users/paterjoachim/Documents/YOUCAT Love forever Korrektur";
const theologicalMapPath = process.env.YOUCAT_THEOLOGICAL_MAP_PATH
  || "/Users/paterjoachim/Documents/Codex/2026-06-18/sites-plugin-sites-openai-bundled-create/public/map/data.js";

const requiredProjectFiles = [
  "package.json",
  "src/main.js",
  "src/data/official-content.json",
  "src/data/learning-content.js",
  "src/data/deep-dive-sources.js",
];
const publicationFiles = [
  "YOUCAT_loveforever_QA_EN.md",
  "YOUCAT_loveforever_QA_PT.md",
  "YOUCAT_QA_PT.md",
  "DOCAT_QA_PT.md",
  "theological-map/reference-texts.js",
];
const firebaseKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

const errors = [];
const warnings = [];
const ok = [];

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readEnv(filePath) {
  if (!exists(filePath)) return new Map();
  const values = new Map();
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values.set(match[1], match[2].trim());
  }
  return values;
}

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
if (nodeMajor >= 22) ok.push(`Node ${process.versions.node}`);
else errors.push(`Node 22 or newer is required; found ${process.versions.node}`);

for (const relativePath of requiredProjectFiles) {
  if (exists(path.join(projectRoot, relativePath))) ok.push(relativePath);
  else errors.push(`Missing project file: ${relativePath}`);
}

const missingPublicationFiles = publicationFiles.filter(
  (relativePath) => !exists(path.join(publicationRoot, relativePath)),
);
if (missingPublicationFiles.length === 0) {
  ok.push("Authenticated publication sources");
} else {
  warnings.push(
    `Authenticated-source regeneration is unavailable; missing: ${missingPublicationFiles.join(", ")}`,
  );
}

if (exists(theologicalMapPath)) ok.push("Theological map source");
else warnings.push("Theological map source is missing; npm run content cannot be regenerated");

const envPath = path.join(projectRoot, ".env.local");
const env = readEnv(envPath);
const missingFirebaseKeys = firebaseKeys.filter((key) => !env.get(key));
if (missingFirebaseKeys.length === 0) ok.push("Local Firebase configuration");
else warnings.push("Firebase configuration is incomplete; the app will use safe local-preview mode");

const java = spawnSync("java", ["-version"], { encoding: "utf8" });
const javaVersion = `${java.stderr || ""}${java.stdout || ""}`.match(/version \"([^\"]+)/)?.[1];
if (java.status === 0 && javaVersion) ok.push(`Java ${javaVersion} (load tests)`);
else warnings.push("Java is unavailable; the Firebase emulator load test cannot run");

console.log("YOUCAT event demo environment\n");
for (const item of ok) console.log(`OK    ${item}`);
for (const item of warnings) console.log(`WARN  ${item}`);
for (const item of errors) console.log(`ERROR ${item}`);

if (errors.length) {
  console.error(`\nEnvironment check failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(`\nEnvironment ready${warnings.length ? ` with ${warnings.length} warning(s)` : ""}.`);
