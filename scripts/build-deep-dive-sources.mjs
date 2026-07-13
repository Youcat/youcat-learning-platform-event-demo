import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { load } from "cheerio";

const truthbaseRoot = "/Users/paterjoachim/Documents/YOUCAT Love forever Korrektur";
const referenceBundle = path.join(truthbaseRoot, "theological-map/reference-texts.js");
const youcatPath = path.join(truthbaseRoot, "YOUCAT_QA_PT.md");
const docatPath = path.join(truthbaseRoot, "DOCAT_QA_PT.md");
const outputPath = new URL("../src/data/deep-dive-sources.js", import.meta.url);
const cacheRoot = path.join(truthbaseRoot, "theological-map/tmp/reference-cache");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(referenceBundle, "utf8"), sandbox);
const references = sandbox.window.YOUCAT_REFERENCE_TEXTS.PT;

function qaText(filePath, number) {
  const markdown = fs.readFileSync(filePath, "utf8");
  const match = markdown.match(new RegExp(`^## ${number}\\. .*?\\n\\n([\\s\\S]*?)(?=\\n\\n## |$)`, "m"));
  if (!match) throw new Error(`Missing authenticated Q&A ${number} in ${filePath}`);
  return match[1].trim();
}

function passage(abbr, label) {
  for (const source of Object.values(references)) {
    if (source.abbr !== abbr) continue;
    const found = source.passages?.find((item) => item.label === label);
    if (found) return clean(found.text);
  }
  throw new Error(`Missing reference ${abbr} ${label}`);
}

function keyedPassage(key, label) {
  const source = references[key];
  const found = source?.passages?.find((item) => item.label === label);
  if (!found) throw new Error(`Missing reference ${key} / ${label}`);
  return clean(found.text);
}

function clean(text) {
  return text
    .replace(/\u00ad/g, "")
    .replace(/\s+\($/, "")
    .replace(/\s+AS OFENSAS À CASTIDADE$/, "")
    .replace(/\s+Amor que se manifesta e cresce$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const htmlFiles = fs.readdirSync(cacheRoot);
const parsedHtml = new Map();
const htmlFragments = {
  AL: "francesco_pt_apost_exhortations_documents_papa-francesco_esortazione-ap_20160319_amoris-laetitia.html.html",
  CV: "francesco_pt_apost_exhortations_documents_papa-francesco_esortazione-ap_20190325_christus-vivit.html.html",
  FC: "john-paul-ii_pt_apost_exhortations_documents_hf_jp-ii_exh_19811122_familiaris-consortio.html.html",
  HV: "paul-vi_pt_encyclicals_documents_hf_p-vi_enc_25071968_humanae-vitae.html.html",
};

function paragraphsFromFile(fileName) {
  if (parsedHtml.has(fileName)) return parsedHtml.get(fileName);
  const $ = load(fs.readFileSync(path.join(cacheRoot, fileName)));
  const paragraphs = $("p").map((_, element) => {
    const paragraph = $(element).clone();
    paragraph.find("sup").remove();
    return paragraph.text().replace(/\u00ad/g, "").replace(/\s+/g, " ").trim();
  }).get().filter(Boolean);
  parsedHtml.set(fileName, paragraphs);
  return paragraphs;
}

function htmlSection(abbr, number) {
  const candidates = abbr === "CCC"
    ? htmlFiles.filter((file) => file.includes("archive_cathechism_po_index_new_") && file.endsWith(".html.html"))
    : htmlFiles.filter((file) => file.includes(htmlFragments[abbr]));
  for (const fileName of candidates) {
    const paragraphs = paragraphsFromFile(fileName);
    const start = paragraphs.findIndex((text) => new RegExp(`^${number}\\.`).test(text));
    if (start < 0) continue;
    if (!new Set(["CCC", "FC", "HV"]).has(abbr)) return clean(paragraphs[start]);
    const section = [paragraphs[start]];
    for (let index = start + 1; index < paragraphs.length; index += 1) {
      if (/^\d{1,4}\./.test(paragraphs[index])) break;
      section.push(paragraphs[index]);
    }
    while (section.length > 1 && !/[.!?;:»”)]$/.test(section.at(-1))) section.pop();
    return section.map(clean).join("\n\n");
  }
  throw new Error(`Missing cached Vatican paragraph ${abbr} ${number}`);
}

const names = {
  CCC: "Catecismo da Igreja Católica",
  AL: "Amoris Laetitia",
  CV: "Christus Vivit",
  FC: "Familiaris Consortio",
  HV: "Humanae Vitae",
  CIC: "Código de Direito Canônico",
  YOUCAT: "YOUCAT",
  DOCAT: "DOCAT",
  B: "Bíblia — fonte portuguesa atual do mapa",
};

const page = (source, title, body, editionNote = "") => ({
  source,
  title: { en: title, pt: title },
  body: { en: body, pt: body },
  ...(editionNote ? { editionNote } : {}),
});
const ref = (abbr, number, label = String(number)) => page(
  `${abbr} ${number}`,
  names[abbr],
  new Set(["CCC", "AL", "CV", "FC", "HV"]).has(abbr) ? htmlSection(abbr, number) : passage(abbr, label),
);
const youcat = (number) => page(`YOUCAT ${number}`, names.YOUCAT, qaText(youcatPath, number));
const docat = (number) => page(`DOCAT ${number}`, names.DOCAT, qaText(docatPath, number));
const bible = (source, key, label) => page(
  source,
  names.B,
  keyedPassage(key, label),
  "A Theological Map identifica atualmente esta fonte como Bíblia Ave Maria, não Bíblia de Jerusalém.",
);

const deepDiveSources = {
  3: [
    ref("CCC", 1766), ref("CCC", 1774), ref("AL", 39),
    bible("Gn 2,24", "B|Gen 2,24", "Genesis 2:24"),
  ],
  14: [ref("CCC", 2390), youcat(407), ref("AL", 153), ref("HV", 12)],
  25: [
    ref("CCC", 2690), ref("CV", 246),
    bible("Lc 24,13–35", "B|Spr 15,22; Lk 24,13–35", "Luke 24:13-35"),
  ],
  34: [
    bible("Mt 6,21–23", "B|Mt 6,21–23; Röm 7,19–20", "Matthew 6:21-23"),
    youcat(412), ref("CV", 88), ref("CV", 90), ref("AL", 151),
  ],
  59: [
    ref("CCC", 2347), youcat(404),
    bible("Pr 2,11–17", "B|Spr 2,11–17", "Proverbs 2:11-17"),
  ],
  68: [ref("CCC", 2350), youcat(407), ref("AL", 74), ref("AL", 132), ref("FC", 11)],
  83: [ref("CCC", 2350), ref("AL", 132), ref("FC", 81), docat(8)],
  126: [ref("CCC", 1615), youcat(263), ref("AL", 62), ref("AL", 162), ref("FC", 13)],
  127: [
    ref("CCC", 1646), ref("AL", 124),
    page("CIC 1152–1155", names.CIC, references["CIC|1152–1155"].text),
    ref("AL", 241),
  ],
  140: [
    bible("1Cor 13,1–13", "B|1 Kor 13,1–13; Joh 12,24–25; Joh 15,13", "1 Corinthians 13:1-13"),
    youcat(8), youcat(193), youcat(263),
    ref("AL", 89), ref("AL", 90), ref("AL", 133), ref("AL", 135),
    bible("Jo 15,13", "B|1 Kor 13,1–13; Joh 12,24–25; Joh 15,13", "John 15:13"),
  ],
};

const generated = `// Generated from the authenticated Portuguese YOUCAT files and the local Theological Map.\n// Run npm run deep-dive-content to rebuild.\n\nconst deepDiveSources = ${JSON.stringify(deepDiveSources, null, 2)};\n\nexport default deepDiveSources;\n`;
fs.writeFileSync(outputPath, generated);
console.log(`Generated ${Object.values(deepDiveSources).flat().length} verbatim source pages.`);
