const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const MENUS_DIR = path.join(DATA_DIR, "menus");
const INDEX_FILE = path.join(DATA_DIR, "generated/sutta_index.json");
const LEGACY_DIR = path.join(DATA_DIR, "bilara-data-published/legacy");
const LEGACY_MAP_FILE = path.join(
  DATA_DIR,
  "bilara-data-published/legacy_sutta_map.json",
);
const API_BASE = "https://suttacentral.net/api";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Error fetching ${url}:`, err.message);
    return null;
  }
}

async function run() {
  console.log("Searching for missing suttas to generate Legacy fallback...");

  if (!fs.existsSync(INDEX_FILE)) {
    console.error("sutta_index.json not found! Run build_index.js first.");
    return;
  }

  const suttaIndex = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));
  let legacyMap = {};
  if (fs.existsSync(LEGACY_MAP_FILE)) {
    legacyMap = JSON.parse(fs.readFileSync(LEGACY_MAP_FILE, "utf8"));
  }

  // 1. Gather all leaf nodes from menus
  const menuFiles = fs
    .readdirSync(MENUS_DIR)
    .filter((f) => f.endsWith(".json"));
  const leafNodes = new Set();

  menuFiles.forEach((file) => {
    try {
      const content = JSON.parse(
        fs.readFileSync(path.join(MENUS_DIR, file), "utf8"),
      );
      const nodesToProcess = Array.isArray(content) ? content : [content];

      function extractLeaves(node) {
        if (node.node_type === "leaf") {
          leafNodes.add(node.uid);
        }
        if (node.children) {
          node.children.forEach(extractLeaves);
        }
      }

      nodesToProcess.forEach(extractLeaves);
    } catch (err) {}
  });

  const allLeaves = Array.from(leafNodes);
  console.log(`Found ${allLeaves.length} leaf nodes in menus.`);

  const missingLeaves = allLeaves.filter((uid) => !suttaIndex[uid]);
  console.log(
    `Found ${missingLeaves.length} leaf nodes missing from Bilara data.`,
  );

  // 2. Process missing ones
  let count = 0;
  for (const uid of missingLeaves) {
    // If we already have it in legacy Map, skip
    if (legacyMap[uid]) {
      continue;
    }

    console.log(`Processing missing sutta: ${uid}`);
    // Fetch suttaplex to find authors
    const suttaplexData = await fetchJson(`${API_BASE}/suttaplex/${uid}`);
    await sleep(200);

    // suttaplex API sometimes returns an array, sometimes an object directly depending on API endpoint, Suttaplex usually returns array of length 1
    const plex = Array.isArray(suttaplexData)
      ? suttaplexData[0]
      : suttaplexData;
    if (!plex) continue;

    // Find an English translation (prefer non-segmented/legacy if indicated)
    let engTranslations = (plex.translations || []).filter(
      (t) => t.lang === "en",
    );
    if (engTranslations.length === 0) {
      console.log(`  No English translation found for ${uid}`);
      continue;
    }

    const targetTrans = engTranslations[0]; // fallback to first
    const authorUid = targetTrans.author_uid;

    const suttaApiData = await fetchJson(
      `${API_BASE}/suttas/${uid}/${authorUid}?lang=en`,
    );
    await sleep(200);

    if (
      suttaApiData &&
      suttaApiData.translation &&
      suttaApiData.translation.text
    ) {
      const htmlContent = suttaApiData.translation.text;
      const targetDir = path.join(LEGACY_DIR, "en", authorUid);
      const targetFile = path.join(targetDir, `${uid}.html`);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.writeFileSync(targetFile, htmlContent, "utf8");

      const relativePath = path
        .relative(path.join(DATA_DIR, "bilara-data-published"), targetFile)
        .replace(/\\/g, "/");

      legacyMap[uid] = {
        author_uid: authorUid,
        path: relativePath,
      };

      console.log(`  Saved legacy HTML for ${uid} -> ${relativePath}`);
      count++;

      // Save map incrementally to avoid complete loss on crash
      if (count % 10 === 0) {
        fs.writeFileSync(LEGACY_MAP_FILE, JSON.stringify(legacyMap, null, 2));
      }
    }
  }

  // Final save
  fs.writeFileSync(LEGACY_MAP_FILE, JSON.stringify(legacyMap, null, 2));
  console.log(
    `Completed fetching legacy data. Newly fetched: ${count} / Failed: ${missingLeaves.length - count - Object.keys(legacyMap).length}`,
  );
}

run();
