const fs = require("fs");
const path = require("path");

const API_BASE = "https://suttacentral.net/api/menu";

/**
 * sleep function to be polite to the API
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches menu data for a given UID
 */
async function fetchMenu(uid) {
  const url = `${API_BASE}/${uid}`;
  console.log(`Fetching: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch ${uid}:`, error);
    return null; // Return null to indicate failure but allow continuation
  }
}

/**
 * recursively processes nodes and fetches children branches
 */
async function processNode(node, baseDir) {
  // If it's a branch, we might need to fetch its children if they aren't fully populated
  // However, the Top-level JSON usually has some children.
  // The key is: if we fetched this node from API, it effectively "is" the file content we save.
  // Then we look at ITS children.

  if (!node.children || node.children.length === 0) {
    return;
  }

  for (const child of node.children) {
    if (child.node_type === "branch") {
      const uid = child.uid;

      // 1. Fetch the full detailed menu for this branch
      await sleep(200); // Be polite
      const data = await fetchMenu(uid);

      if (data) {
        // SuttaCentral API returns an array, usually with one item for that menu
        // OR it might return just the object. Let's handle both.
        // Based on previous `sn-sagathavaggasamyutta` check, it returned `[{...}]`.
        const fetchedNode = Array.isArray(data) ? data[0] : data;

        // 2. Save this file
        const filePath = path.join(baseDir, `${uid}.json`);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(fetchedNode, null, 2));
        console.log(`Saved: ${filePath}`);

        // 3. Recurse
        await processNode(fetchedNode, baseDir);
      }
    }
  }
}

/**
 * Main function to start processing a Nikaya
 * @param {string} rootFile Path to the root nikaya json file (e.g., 'menus/sn.json')
 * @param {string} outputDir Directory to save fetched sub-menus
 */
async function processNikaya(rootFile, outputDir) {
  console.log(`Starting processing for ${rootFile}...`);

  if (!fs.existsSync(rootFile)) {
    console.error(`Root file not found: ${rootFile}`);
    return;
  }

  const content = fs.readFileSync(rootFile, "utf8");
  const rootData = JSON.parse(content);

  // rootData is typically an array `[{ uid: 'sn', ... }]`
  const rootNode = Array.isArray(rootData) ? rootData[0] : rootData;

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Start processing children of the root node
  await processNode(rootNode, outputDir);
  console.log(`Completed processing for ${rootFile}`);
}

module.exports = {
  processNikaya,
};
