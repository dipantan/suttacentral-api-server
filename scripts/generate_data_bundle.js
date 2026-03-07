const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const DATA_DIR = path.resolve(__dirname, "../data");
const OUTPUT_DIR = path.resolve(__dirname, "../public");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "data.zip");

function addDirectoryToZip(zip, dirPath, rootPath) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    // Skip .git, node_modules, and legacy seed; include menus/generated in bundle
    if (
      file === ".git" ||
      file === "node_modules" ||
      file === "legacy-seed"
    ) {
      continue;
    }

    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    const relativePath = path.relative(rootPath, filePath).replace(/\\/g, "/");

    // Also skip any nested legacy-seed content if reached indirectly
    if (relativePath.startsWith("legacy-seed/")) {
      continue;
    }

    if (stat.isDirectory()) {
      addDirectoryToZip(zip, filePath, rootPath);
    } else {
      const content = fs.readFileSync(filePath);
      zip.file(relativePath, content);
    }
  }
}

async function generateBundle() {
  console.log("📦 Starting data bundle generation...");

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ Data directory not found: ${DATA_DIR}`);
    throw new Error(`Data directory not found: ${DATA_DIR}`);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log(`📂 Creating output directory: ${OUTPUT_DIR}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const zip = new JSZip();

  console.log(`📂 Scanning data from: ${DATA_DIR}`);
  addDirectoryToZip(zip, DATA_DIR, DATA_DIR);

  console.log("Waiting for zip compression...");

  return new Promise((resolve, reject) => {
    zip
      .generateNodeStream({
        type: "nodebuffer",
        streamFiles: true,
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      })
      .pipe(fs.createWriteStream(OUTPUT_FILE))
      .on("finish", function () {
        console.log(`✅ Data bundle created at: ${OUTPUT_FILE}`);
        const stats = fs.statSync(OUTPUT_FILE);
        console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
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
