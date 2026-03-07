const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { generateBundle } = require("./generate_data_bundle");

const SERVER_DIR = path.resolve(__dirname, "..");
const BILARA_DATA_DIR = path.join(SERVER_DIR, "data/bilara-data-published");
const PUBLIC_DIR = path.join(SERVER_DIR, "public");
const VERSION_FILE = path.join(PUBLIC_DIR, "data.json");
const LEGACY_DIR = path.join(BILARA_DATA_DIR, "legacy");
const LEGACY_MAP_FILE = path.join(BILARA_DATA_DIR, "legacy_sutta_map.json");
const MENUS_DIR = path.join(SERVER_DIR, "data/menus");
const LEGACY_SEED_DIR = path.join(SERVER_DIR, "data/legacy-seed");
const LEGACY_SEED_MAP = path.join(LEGACY_SEED_DIR, "legacy_sutta_map.json");

function copyLegacySeed() {
  if (!fs.existsSync(LEGACY_SEED_DIR)) return false;
  if (!fs.existsSync(BILARA_DATA_DIR)) {
    fs.mkdirSync(BILARA_DATA_DIR, { recursive: true });
  }
  console.log("Restoring legacy from seed directory...");
  fs.cpSync(LEGACY_SEED_DIR, LEGACY_DIR, { recursive: true });
  if (fs.existsSync(LEGACY_SEED_MAP)) {
    fs.copyFileSync(LEGACY_SEED_MAP, LEGACY_MAP_FILE);
  }
  return true;
}

/**
 * Execute a command synchronously and stream output to console.
 */
function runCommand(command, cwd = SERVER_DIR) {
  console.log(`\n> [EXEC] ${command} (cwd: ${cwd})`);
  try {
    const output = execSync(command, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.log(output);
    return output.trim();
  } catch (err) {
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);
    console.error(`❌ Command failed: ${command}`);
    throw err;
  }
}

async function buildPipeline() {
  console.log("🚀 Starting Offline Data Build Pipeline...\n");

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  // --- Step 1: Git Pull / Clone ---
  console.log("--- Step 1: Syncing Git Data ---");
  const BILARA_REPO_URL = "https://github.com/suttacentral/bilara-data.git";
  let isFreshClone = false;

  if (!fs.existsSync(path.join(BILARA_DATA_DIR, ".git"))) {
    console.log(`📂 Data directory or .git missing. Performing fresh clone...`);
    const parentDir = path.dirname(BILARA_DATA_DIR);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    // Perform shallow clone of only the 'published' branch
    runCommand(
      `git clone --branch published --depth 1 ${BILARA_REPO_URL} bilara-data-published`,
      parentDir,
    );
    isFreshClone = true;
  } else {
    try {
      const pullOutput = runCommand(
        "git pull origin published",
        BILARA_DATA_DIR,
      );
      if (pullOutput.includes("Already up to date.")) {
        console.log("ℹ️ Data repo up to date. Continuing full build to refresh bundle.");
      }
    } catch (err) {
      console.warn(
        `⚠️ Git pull failed. Continuing build with current local state...`,
      );
    }
  }

  // --- Step 2: Get Commit Info ---
  console.log("\n--- Step 2: Retrieving Commit Status ---");
  let commitHash = "unknown";
  let commitDateRaw = new Date().toISOString();

  try {
    commitHash = runCommand("git rev-parse HEAD", BILARA_DATA_DIR);
    // Get ISO 8601 date string of commit
    commitDateRaw = runCommand(
      "git show -s --format=%cI HEAD",
      BILARA_DATA_DIR,
    );
  } catch (err) {
    console.warn(
      "⚠️ Failed to retrieve git commit info. Using fallback dates.",
    );
  }

  const versionInfo = {
    commit: commitHash,
    date: commitDateRaw,
    updated_at: new Date().toISOString(),
  };
  console.log(`Latest commit: ${commitHash} from ${commitDateRaw}`);

  // --- Step 3: Fetch & Flatten Menus ---
  console.log("\n--- Step 3: Fetching and Flattening Menus ---");
  const menusExists = fs.existsSync(MENUS_DIR) && fs.readdirSync(MENUS_DIR).length > 0;
  if (menusExists) {
    console.log("Menus already present; skipping master_fetch.js");
  } else {
    runCommand(`node scripts/master_fetch.js`);
  }

  // --- Step 4: Clean Bilara Target ---
  console.log("\n--- Step 4: Cleaning Bilara Data (Keeping Legacy Safe) ---");
  // cleanup_bilara.js already ignores the `legacy` directory implicitly because it's not in its target lists.
  // Let's ensure it runs safely.
  runCommand(`node scripts/cleanup_bilara.js`);

  // --- Step 5: Build Sutta Index ---
  console.log("\n--- Step 5: Building Sutta Index ---");
  runCommand(`node scripts/build_index.js`);

  // --- Step 6: Fetch missing Legacy Suttas (skip if legacy already provided) ---
  if (fs.existsSync(LEGACY_DIR) || fs.existsSync(LEGACY_MAP_FILE)) {
    console.log(
      "\n--- Step 6: Skipping legacy fetch (legacy content already present) ---",
    );
  } else if (copyLegacySeed()) {
    console.log("Legacy restored from seed. Skipping fetch.");
  } else {
    console.log("\n--- Step 6: Fetching legacy content for missing suttas ---");
    runCommand(`node scripts/fetch_legacy.js`);
  }

  // --- Step 7: Generate Zip Bundle ---
  console.log("\n--- Step 7: Generating Zip Bundle ---");
  try {
    const finalZipPath = await generateBundle();
    console.log(`✅ Zip successfully generated at: ${finalZipPath}`);

    // --- Step 8: Write Version Tracker ---
    console.log("\n--- Step 8: Writing Version History ---");
    fs.writeFileSync(VERSION_FILE, JSON.stringify(versionInfo, null, 2));
    console.log(`✅ Version tracking saved to ${VERSION_FILE}`);
  } catch (err) {
    console.error("❌ Zip generation failed:", err);
    process.exit(1);
  }

  console.log("\n🎉 Pipeline Completed Successfully!");
}

buildPipeline().catch((err) => {
  console.error("🚨 Pipeline encountered a fatal error:\n", err);
  process.exit(1);
});
