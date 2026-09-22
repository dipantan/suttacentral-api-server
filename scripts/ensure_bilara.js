/**
 * Ensures the bilara-data-published dataset exists on disk.
 * Used by Render (and other ephemeral hosts) during the build step,
 * since the 1.3GB dataset is intentionally not tracked in this repo.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const BILARA_DIR = path.join(DATA_DIR, "bilara-data-published");
const REPO_URL = "https://github.com/suttacentral/bilara-data.git";

if (fs.existsSync(path.join(BILARA_DIR, "root"))) {
  console.log("✅ bilara-data-published already present, skipping clone.");
  process.exit(0);
}

console.log("📥 Cloning suttacentral/bilara-data (branch: published, shallow)...");
fs.mkdirSync(DATA_DIR, { recursive: true });
execSync(
  `git clone --branch published --depth 1 ${REPO_URL} "${BILARA_DIR}"`,
  { stdio: "inherit" }
);
console.log("✅ bilara-data clone complete.");
