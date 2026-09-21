const fs = require("fs");
const path = require("path");

const BASE_DIR = path.join(__dirname, "../data/bilara-data-published");
const ROOT_DIR = path.join(BASE_DIR, "root/pli/ms");
const TRANSLATION_DIR = path.join(BASE_DIR, "translation/en");
const OUTPUT_FILE = path.join(__dirname, "../data/generated/sutta_index.json");
const OUTPUT_DIR = path.dirname(OUTPUT_FILE);

// Helper to walk directories recursively
function walkSync(dir, filelist = []) {
  if (!fs.existsSync(dir)) return filelist;
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      filelist = walkSync(filePath, filelist);
    } else {
      filelist.push(filePath);
    }
  });
  return filelist;
}

function buildIndex() {
  console.log("Building Sutta Index...");
  const index = {};

  // 1. Index Roots
  console.log("Scanning Roots...");
  if (fs.existsSync(ROOT_DIR)) {
    const rootFiles = walkSync(ROOT_DIR);
    rootFiles.forEach((fullPath) => {
      if (fullPath.endsWith("_root-pli-ms.json")) {
        const filename = path.basename(fullPath);
        const uid = filename.replace("_root-pli-ms.json", "");
        const relativePath = path.relative(ROOT_DIR, fullPath);

        if (!index[uid]) {
          index[uid] = {
            root: relativePath,
            translations: {},
          };
        }
      }
    });
  } else {
    console.warn(`Root directory not found: ${ROOT_DIR}`);
  }

  // 2. Index Translations across all languages (en, bn, hi, etc.)
  const TRANSLATIONS_BASE = path.join(BASE_DIR, "translation");
  console.log("Scanning Translations...");
  if (fs.existsSync(TRANSLATIONS_BASE)) {
    const langs = fs.readdirSync(TRANSLATIONS_BASE);
    langs.forEach((lang) => {
      const langDir = path.join(TRANSLATIONS_BASE, lang);
      if (!fs.existsSync(langDir) || !fs.statSync(langDir).isDirectory()) return;

      const authors = fs.readdirSync(langDir);
      authors.forEach((author) => {
        const authorDir = path.join(langDir, author);
        if (!fs.existsSync(authorDir) || !fs.statSync(authorDir).isDirectory()) return;

        console.log(`  - Indexing [${lang}] author: ${author}`);
        const transFiles = walkSync(authorDir);
        transFiles.forEach((fullPath) => {
          const filename = path.basename(fullPath);
          const match = filename.match(/^(.+)_translation-([a-z]+)-(.+)\.json$/);
          if (match) {
            const uid = match[1];
            if (!index[uid]) {
              index[uid] = { root: null, translations: {} };
            }
            if (!index[uid].translations) {
              index[uid].translations = {};
            }

            const relativePath = path.relative(authorDir, fullPath).replace(/\\/g, "/");
            const transKey = lang === "en" ? author : `${author}_${lang}`;
            index[uid].translations[transKey] = relativePath;

            if (!index[uid].translation_info) {
              index[uid].translation_info = {};
            }
            index[uid].translation_info[transKey] = {
              author,
              lang,
              path: `translation/${lang}/${author}/${relativePath}`,
            };
          }
        });
      });
    });
  } else {
    console.warn(`Translation directory not found: ${TRANSLATIONS_BASE}`);
  }

  // 3. Index Legacy Translations
  const LEGACY_MAP_FILE = path.join(BASE_DIR, "legacy_sutta_map.json");
  console.log("Scanning Legacy Translations...");
  if (fs.existsSync(LEGACY_MAP_FILE)) {
    const legacyMap = JSON.parse(fs.readFileSync(LEGACY_MAP_FILE, "utf8"));
    Object.entries(legacyMap).forEach(([uid, info]) => {
      if (!index[uid]) {
        index[uid] = { root: null, translations: {} };
      }
      // Store the legacy path. We'll use a special author prefix "legacy-" 
      // or just the author_uid if unique.
      // fetch_legacy.js stores it as legacy/en/{author}/{uid}.html
      index[uid].translations[info.author_uid] = info.path;
    });
    console.log(`  - Added ${Object.keys(legacyMap).length} legacy translations.`);
  }

  const outputCount = Object.keys(index).length;
  console.log(`Indexed ${outputCount} suttas.`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Sanity check: log ds1.1 if it has a legacy translation now
  if (index["ds1.1"]) {
    console.log("Sample (ds1.1):", JSON.stringify(index["ds1.1"], null, 2));
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));
  console.log(`Index saved to ${OUTPUT_FILE}`);
}

buildIndex();
