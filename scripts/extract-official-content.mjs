import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const sourceRoot = process.env.YOUCAT_PUBLICATION_PATH
  || "/Users/paterjoachim/Documents/YOUCAT Love forever Korrektur";
const mapPath = process.env.YOUCAT_THEOLOGICAL_MAP_PATH
  || "/Users/paterjoachim/Documents/Codex/2026-06-18/sites-plugin-sites-openai-bundled-create/public/map/data.js";
const selectedNumbers = [3, 14, 25, 34, 59, 68, 83, 126, 127, 140];

function parseBook(markdown) {
  const entries = new Map();
  const pattern = /^##\s+(\d+)\.\s+(.+)\n\n([\s\S]*?)(?=\n##\s+\d+\.|\s*$)/gm;
  for (const match of markdown.matchAll(pattern)) {
    entries.set(Number(match[1]), {
      question: match[2].trim(),
      answer: match[3].trim().replace(/\n{3,}/g, "\n\n"),
    });
  }
  return entries;
}

function readLanguage(language) {
  const file = path.join(sourceRoot, `YOUCAT_loveforever_QA_${language}.md`);
  return parseBook(fs.readFileSync(file, "utf8"));
}

function readMap() {
  const source = fs.readFileSync(mapPath, "utf8").trim();
  const json = source.slice(source.indexOf("=") + 1).replace(/;$/, "").trim();
  return JSON.parse(json);
}

const english = readLanguage("EN");
const portuguese = readLanguage("PT");
const theologicalMap = readMap();

const questions = selectedNumbers.map((number) => {
  const en = english.get(number);
  const pt = portuguese.get(number);
  const mapEntry = theologicalMap.entries.find((entry) => entry.id === `L-${number}`);
  if (!en || !pt || !mapEntry) throw new Error(`Missing authenticated content for Q${number}`);

  return {
    id: `love-${number}`,
    number,
    official: { en, pt },
    sourceReferences: mapEntry.sourceReferences ?? [],
  };
});

const output = {
  generatedFrom: {
    publication: "Authenticated YOUCAT Love Forever Markdown",
    map: "YOUCAT Theological Map",
  },
  questions,
};

fs.writeFileSync(
  path.join(projectRoot, "src/data/official-content.json"),
  `${JSON.stringify(output, null, 2)}\n`,
);

console.log(`Extracted ${questions.length} authenticated questions in EN and PT.`);
