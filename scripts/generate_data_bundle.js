const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const DATA_DIR = path.resolve(__dirname, "../data");
const OUTPUT_DIR = path.resolve(__dirname, "../public");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "data.zip");

const SUTTA_INDEX_PATH = path.join(DATA_DIR, "generated/sutta_index.json");
const MENUS_DIR = path.join(DATA_DIR, "menus");
const BILARA_DIR = path.join(DATA_DIR, "bilara-data-published");

/**
 * Minifies JSON content by removing all whitespace.
 */
function minifyJson(content) {
  try {
    return JSON.stringify(JSON.parse(content));
  } catch (e) {
    return content;
  }
}

/**
 * Recursively adds JSON files to the zip, minifying them.
 * @param {JSZip} zip 
 * @param {string} dirPath 
 * @param {string} zipSubDir 
 */
function addJsonFilesToZip(zip, dirPath, zipSubDir) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      addJsonFilesToZip(zip, fullPath, path.join(zipSubDir, entry.name));
    } else if (entry.name.endsWith(".json")) {
      const content = fs.readFileSync(fullPath, "utf8");
      const zipPath = path.join(zipSubDir, entry.name).replace(/\\/g, "/");
      zip.file(zipPath, minifyJson(content));
    }
  }
}

async function generateBundle() {
  console.log("📦 Starting optimized data bundle generation (Saddhamma Compatible Structure)...");

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const zip = new JSZip();
  const BUNDLE_ROOT = "data";
  const BUNDLE_BASE = "bilara-data-published";

  // 1. Process sutta_index.json
  if (fs.existsSync(SUTTA_INDEX_PATH)) {
    console.log("📄 Processing sutta_index.json...");
    const index = JSON.parse(fs.readFileSync(SUTTA_INDEX_PATH, "utf8"));
    
    // Ensure paths in index are standard Bilara relative paths (relative to root/pli/ms or translation/en/author)
    Object.keys(index).forEach(uid => {
      const entry = index[uid];
      if (entry.root) {
        entry.root = entry.root.replace(/\\/g, "/");
      }
      if (entry.translations) {
        Object.keys(entry.translations).forEach(author => {
          entry.translations[author] = entry.translations[author].replace(/\\/g, "/");
        });
      }
    });

    zip.file(`${BUNDLE_ROOT}/sutta_index.json`, JSON.stringify(index));
  }

  // 2. Add menus/ to root
  if (fs.existsSync(MENUS_DIR)) {
    console.log("📂 Adding menus/...");
    addJsonFilesToZip(zip, MENUS_DIR, `${BUNDLE_ROOT}/menus`);
  }

  // 3. Add bilara-data-published/ core content
  console.log("📂 Processing bilara-data-published/ content...");

  // A. Pali Roots
  const rootPliDir = path.join(BILARA_DIR, "root/pli/ms");
  if (fs.existsSync(rootPliDir)) {
    console.log("  - Adding roots...");
    addJsonFilesToZip(zip, rootPliDir, `${BUNDLE_ROOT}/${BUNDLE_BASE}/root/pli/ms`);
  }

  // B. English Translations
  const enTransDir = path.join(BILARA_DIR, "translation/en");
  if (fs.existsSync(enTransDir)) {
    console.log("  - Adding translations (en)...");
    addJsonFilesToZip(zip, enTransDir, `${BUNDLE_ROOT}/${BUNDLE_BASE}/translation/en`);
  }

  // C. English Comments
  const enCommentDir = path.join(BILARA_DIR, "comment/en");
  if (fs.existsSync(enCommentDir)) {
    console.log("  - Adding comments (en)...");
    addJsonFilesToZip(zip, enCommentDir, `${BUNDLE_ROOT}/${BUNDLE_BASE}/comment/en`);
  }

  // D. Legacy Content (HTML fallbacks)
  const legacyDir = path.join(BILARA_DIR, "legacy");
  if (fs.existsSync(legacyDir)) {
    console.log("  - Adding legacy content...");
    addJsonFilesToZip(zip, legacyDir, `${BUNDLE_ROOT}/${BUNDLE_BASE}/legacy`);
  }

  // E. Legacy Map
  const legacyMapFile = path.join(BILARA_DIR, "legacy_sutta_map.json");
  if (fs.existsSync(legacyMapFile)) {
    console.log("  - Adding legacy_sutta_map.json...");
    const content = fs.readFileSync(legacyMapFile, "utf8");
    zip.file(`${BUNDLE_ROOT}/${BUNDLE_BASE}/legacy_sutta_map.json`, minifyJson(content));
  }

  console.log("Waiting for zip compression (Level 9)...");

  return new Promise((resolve, reject) => {
    zip
      .generateNodeStream({
        type: "nodebuffer",
        streamFiles: true,
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
      })
      .pipe(fs.createWriteStream(OUTPUT_FILE))
      .on("finish", function () {
        const stats = fs.statSync(OUTPUT_FILE);
        console.log(`✅ Data bundle created at: ${OUTPUT_FILE}`);
        console.log(`📊 Final Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        resolve(OUTPUT_FILE);
      })
      .on("error", (err) => {
        console.error("❌ Error writing zip file:", err);
        reject(err);
      });
  });
}

module.exports = {
  generateBundle,
};
