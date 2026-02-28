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

  // 2. Index Translations
  console.log("Scanning Translations...");
  // We need to look into each author's directory
  if (fs.existsSync(TRANSLATION_DIR)) {
    const authors = fs.readdirSync(TRANSLATION_DIR);
    authors.forEach((author) => {
      const authorDir = path.join(TRANSLATION_DIR, author);
      if (fs.existsSync(authorDir) && fs.statSync(authorDir).isDirectory()) {
        console.log(`  - Indexing author: ${author}`);
        const transFiles = walkSync(authorDir);
        transFiles.forEach((fullPath) => {
          // filename format: {uid}_translation-en-{author}.json
          // e.g., dn1_translation-en-sujato.json
          const filename = path.basename(fullPath);
          if (filename.includes("_translation-en-")) {
            const uid = filename.split("_translation-en-")[0];

            // If we have a root for this UID (we should), add the translation
            // If not, we might be adding a translation for a sutta we don't have a root for?
            // (Likely consistent, but safer to check or create entry)
            if (!index[uid]) {
              // This is odd if root is missing, but let's allow it?
              // Actually, let's create a partial entry
              index[uid] = { root: null, translations: {} };
            }

            // We store the relative path from the *author's root*
            // e.g. sutta/dn/dn1_translation-en-sujato.json
            const relativePath = path.relative(authorDir, fullPath);
            index[uid].translations[author] = relativePath;
          }
        });
      }
    });
  } else {
    console.warn(`Translation directory not found: ${TRANSLATION_DIR}`);
  }

  const outputCount = Object.keys(index).length;
  console.log(`Indexed ${outputCount} suttas.`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Sanity check: log dn1
  if (index["dn1"]) {
    console.log("Sample (dn1):", JSON.stringify(index["dn1"], null, 2));
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));
  console.log(`Index saved to ${OUTPUT_FILE}`);
}

buildIndex();
