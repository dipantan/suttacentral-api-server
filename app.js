const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();
const PORT = 3000;

app.use(cors());

// Global state for build process tracking
let buildLogs = [];
let buildProcess = null;

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SuttaCentral Offline API",
      version: "1.0.0",
      description:
        "API for accessing SuttaCentral data offline, including menus, suttaplex, and sutta content.",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local server",
      },
    ],
  },
  apis: ["./app.js"], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const SUTTA_INDEX_PATH = path.join(
  __dirname,
  "data/generated/sutta_index.json",
);
const BILARA_BASE = path.join(__dirname, "data/bilara-data-published");
const MENUS_BASE = path.join(__dirname, "data/menus");
const AUTHOR_META_PATH = path.join(BILARA_BASE, "_author.json");
const PUBLICATION_META_PATH = path.join(BILARA_BASE, "_publication.json");

let suttaIndex = {};
let authorMeta = {};
let publicationMeta = {};

// Load Data
try {
  if (fs.existsSync(SUTTA_INDEX_PATH)) {
    suttaIndex = JSON.parse(fs.readFileSync(SUTTA_INDEX_PATH, "utf8"));
    console.log(`Loaded index with ${Object.keys(suttaIndex).length} entries.`);
  } else {
    console.warn("⚠️ Sutta index not found. Offline data is missing.");
    // Automatic trigger if index is completely missing
    setTimeout(() => {
      console.log("🚀 Starting automatic bootstrap build...");
      buildProcess = triggerOfflineBuild();
    }, 1000);
  }

  if (fs.existsSync(AUTHOR_META_PATH)) {
    authorMeta = JSON.parse(fs.readFileSync(AUTHOR_META_PATH, "utf8"));
    console.log(`Loaded author metadata.`);
  }

  if (fs.existsSync(PUBLICATION_META_PATH)) {
    publicationMeta = JSON.parse(
      fs.readFileSync(PUBLICATION_META_PATH, "utf8"),
    );
    console.log(`Loaded publication metadata.`);
  }
} catch (err) {
  console.error("Error loading metadata:", err);
}

// Helpers
const readJson = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading JSON file ${filePath}:`, err);
  }
  return null;
};

// Helper to handle log capture
const appendLog = (msg) => {
  const timestamp = new Date().toISOString();
  buildLogs.push(`[${timestamp}] ${msg}`);
  // Keep logs bounded to last 1000 lines just in case
  if (buildLogs.length > 1000) buildLogs.shift();
};

const triggerOfflineBuild = () => {
  const scriptPath = path.join(__dirname, "scripts/build_pipeline.js");
  if (!fs.existsSync(scriptPath)) {
    console.error("❌ Build script not found at:", scriptPath);
    return;
  }

  buildLogs = []; // Reset logs on new build
  appendLog("Starting new build process...");

  buildProcess = fork(scriptPath, [], {
    cwd: __dirname,
    stdio: "pipe",
  });

  buildProcess.stdout.on("data", (data) => {
    const lines = data
      .toString()
      .split("\n")
      .filter((line) => line.trim() !== "");
    lines.forEach((line) => {
      console.log(line);
      appendLog(line);
    });
  });

  buildProcess.stderr.on("data", (data) => {
    const lines = data
      .toString()
      .split("\n")
      .filter((line) => line.trim() !== "");
    lines.forEach((line) => {
      console.error(line);
      appendLog(`ERROR: ${line}`);
    });
  });

  buildProcess.on("exit", (code) => {
    console.log(`🏁 Bootstrap build process exited with code ${code}`);
    appendLog(`🏁 Bootstrap build process exited with code ${code}`);
    if (code === 0) {
      console.log("✅ Initial build complete. Data is now available.");
      appendLog("✅ Initial build complete. Data is now available.");
    }
    // Clean up to allow subsequent builds
    buildProcess = null;
  });
  return buildProcess;
};

const getAuthorName = (uid) => {
  if (authorMeta[uid]) return authorMeta[uid].name;
  // Fallback search in publication meta collaborators if needed, but authorMeta should be comprehensive for bilara
  return uid;
};

// Route: Get Menu
// Route: Get Root Menu
/**
 * @openapi
 * /api/menu:
 *   get:
 *     tags: [Navigation]
 *     summary: Get the root menu
 *     description: Returns the top-level menu categories (e.g., Sutta, Vinaya, Abhidhamma) for the main navigation.
 *     responses:
 *       200:
 *         description: Successfully retrieved the root menu.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       500:
 *         description: Root menu not found.
 */
app.get("/api/menu", (req, res) => {
  const rootMenuPath = path.join(MENUS_BASE, "root.json");
  const rootMenu = readJson(rootMenuPath);
  if (rootMenu) {
    res.json(rootMenu);
  } else {
    res.status(500).json({ error: "Root menu not found" });
  }
});

// Route: Get Sub Menu
/**
 * @openapi
 * /api/menu/{uid}:
 *   get:
 *     tags: [Navigation]
 *     summary: Get a specific sub-menu
 *     description: Returns the recursive sub-menu structure for a given collection UID (e.g., 'dn', 'sn').
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: The UID of the menu to retrieve.
 *     responses:
 *       200:
 *         description: Successfully retrieved the sub-menu.
 *       404:
 *         description: Menu not found.
 *       500:
 *         description: Failed to parse menu file.
 */
app.get("/api/menu/:uid", (req, res) => {
  const { uid } = req.params;
  const menuPath = path.join(MENUS_BASE, `${uid}.json`);

  if (fs.existsSync(menuPath)) {
    const menuData = readJson(menuPath);
    if (menuData) {
      res.json(menuData);
    } else {
      res.status(500).json({ error: "Failed to parse menu file" });
    }
  } else {
    res.status(404).json({ error: "Menu not found" });
  }
});

// Route: Get Suttaplex (Available Translations)
/**
 * @openapi
 * /api/suttaplex/{uid}:
 *   get:
 *     tags: [Sutta]
 *     summary: Get suttaplex metadata
 *     description: Returns a list of all available translations, authors, and languages for a given sutta ID.
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: The UID of the sutta (e.g., 'dn1').
 *     responses:
 *       200:
 *         description: Successfully retrieved translations list.
 *       404:
 *         description: Sutta not found in index.
 */
app.get("/api/suttaplex/:uid", (req, res) => {
  const { uid } = req.params;
  const suttaEntry = suttaIndex[uid];

  if (!suttaEntry) {
    return res.status(404).json({ error: "Sutta not found in index" });
  }

  const translations = [];

  // Add Root
  if (suttaEntry.root) {
    translations.push({
      lang: "pli",
      lang_name: "Pali",
      is_root: true,
      author_uid: "ms",
      author_name: getAuthorName("ms"),
      id: uid + "_root-pli-ms",
      segmented: true,
    });
  }

  // Add Translations
  if (suttaEntry.translations) {
    Object.keys(suttaEntry.translations).forEach((authorUid) => {
      const relativePath = suttaEntry.translations[authorUid];
      // Infer language from filename? e.g. dn1_translation-en-sujato.json
      // or from directory structure? translation/en/sujato
      // Let's parse filename
      const filename = path.basename(relativePath);
      const match = filename.match(/translation-([a-z]+)-/);
      const langIso = match ? match[1] : "en"; // Default to en if parsing fails

      translations.push({
        lang: langIso,
        is_root: false,
        author_uid: authorUid,
        author_name: getAuthorName(authorUid),
        id: filename.replace(".json", ""),
        segmented: true, // Bilara texts are segmented
      });
    });
  }

  // Construct Suttaplex Object
  const suttaplex = {
    uid: uid,
    blurb: "Blurb not available offline", // We don't have blurb data easily accessible yet
    translations: translations,
  };

  res.json(suttaplex);
});

// Route: Get Sutta Content
/**
 * @openapi
 * /api/suttas/{uid}:
 *   get:
 *     tags: [Sutta]
 *     summary: Get full sutta content
 *     description: Returns the complete content for a sutta, including the root Pali text, its English translation, HTML structure segments, and scholarly metadata.
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: The UID of the sutta (e.g., 'sn1.1').
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *         description: Optional author UID (e.g., 'sujato') to select a specific translation. Falls back to default if not provided.
 *     responses:
 *       200:
 *         description: Successfully retrieved sutta content object.
 *       404:
 *         description: Sutta not found in index.
 */
app.get("/api/suttas/:uid", (req, res) => {
  const { uid } = req.params;
  const requestedAuthor = req.query.author;

  const suttaEntry = suttaIndex[uid];

  if (!suttaEntry) {
    return res.status(404).json({ error: "Sutta not found in index" });
  }

  // 1. Root
  let rootData = {};
  let rootRelativePath = "";
  if (suttaEntry.root) {
    rootRelativePath = suttaEntry.root;
    const rootPath = path.join(BILARA_BASE, "root/pli/ms", rootRelativePath);
    rootData = readJson(rootPath) || {};
  }

  // 2. Translation Selection Logic
  let selectedAuthor = null;
  let translationRelativePath = null;

  const availableAuthors = Object.keys(suttaEntry.translations || {});

  if (availableAuthors.length > 0) {
    if (requestedAuthor && suttaEntry.translations[requestedAuthor]) {
      selectedAuthor = requestedAuthor;
      translationRelativePath = suttaEntry.translations[selectedAuthor];
    } else {
      if (suttaEntry.translations["sujato"]) {
        selectedAuthor = "sujato";
      } else if (suttaEntry.translations["brahmali"]) {
        selectedAuthor = "brahmali";
      } else {
        selectedAuthor = availableAuthors[0];
      }
      translationRelativePath = suttaEntry.translations[selectedAuthor];
    }
  }

  // 3. Translation Data
  let translationData = {};
  let translationLang = "en"; // Default
  if (selectedAuthor && translationRelativePath) {
    // Determine language from file path or name usually
    // Path: .../translation/en/sujato/sutta/...
    // But we previously parsed filename. Let's rely on standard 'en' for now or parse deeply if needed.
    // For now, assuming 'en' as it's the main corpus we are dealing with offline.
    // If strict, we could look at the path segment: translation/{LANG}/{AUTHOR}
    // But 'translationRelativePath' is from 'sutta/' downwards.
    // Wait, index stores relative from `author/sutta`.
    // So full path is `BILARA_BASE/translation/en/${selectedAuthor}/sutta/${translationRelativePath}`.
    // This assumes 'en'. If we support others, we need to know the lang.
    // For now, hardcoding 'en' as per previous code, but be aware.

    // Attempt to detect Lang if we index it properly?
    // In `suttaEntry.translations`, we key by Author.
    // If multiple langs by same author exist (rare), we might have issues.
    // For this task, we stick to 'en' path.

    const translationPath = path.join(
      BILARA_BASE,
      "translation/en",
      selectedAuthor,
      translationRelativePath,
    );
    translationData = readJson(translationPath) || {};
  }

  // 4. HTML
  let htmlData = {};
  if (suttaEntry.root) {
    const htmlFilename = path
      .basename(suttaEntry.root)
      .replace("_root-pli-ms.json", "_html.json");
    const htmlDir = path.dirname(suttaEntry.root);
    const htmlPath = path.join(
      BILARA_BASE,
      "html/pli/ms",
      htmlDir,
      htmlFilename,
    );
    htmlData = readJson(htmlPath) || {};
  }

  // 5. Context Data: Comments
  // Logic: comment/{lang}/{author}/sutta/{path}
  // Filename: {uid}_comment-{lang}-{author}.json
  // Matches Translation file: {uid}_translation-{lang}-{author}.json
  let commentData = {};
  if (selectedAuthor && translationRelativePath) {
    const commentFilename = path
      .basename(translationRelativePath)
      .replace("translation-", "comment-");
    const commentRelativeDir = path.dirname(translationRelativePath);
    // Assuming 'en' for now
    const commentPath = path.join(
      BILARA_BASE,
      "comment/en",
      selectedAuthor,
      commentRelativeDir,
      commentFilename,
    );
    commentData = readJson(commentPath) || {};
  }

  // 6. Context Data: Variants
  // Logic: variant/pli/ms/sutta/{path}
  // Filename: {uid}_variant-pli-ms.json
  // Matches Root file: {uid}_root-pli-ms.json
  let variantData = {};
  if (rootRelativePath) {
    const variantFilename = path
      .basename(rootRelativePath)
      .replace("root-", "variant-");
    const variantDir = path.dirname(rootRelativePath);
    const variantPath = path.join(
      BILARA_BASE,
      "variant/pli/ms",
      variantDir,
      variantFilename,
    );
    variantData = readJson(variantPath) || {};
  }

  // 7. Context Data: Reference
  // Logic: reference/pli/ms/sutta/{path}
  // Filename: {uid}_reference.json
  // Matches Root file: {uid}_root-pli-ms.json -> replace 'root-pli-ms.json' with 'reference.json'
  let referenceData = {};
  if (rootRelativePath) {
    const referenceFilename = path
      .basename(rootRelativePath)
      .replace("_root-pli-ms.json", "_reference.json");
    const referenceDir = path.dirname(rootRelativePath);
    const referencePath = path.join(
      BILARA_BASE,
      "reference/pli/ms",
      referenceDir,
      referenceFilename,
    );
    referenceData = readJson(referencePath) || {};
  }

  // 8. Publication Data
  // Can be huge, maybe filter by Author?
  // We loaded `publicationMeta`.
  // It's a key-value map. We need to find the entry where `author_uid` matches `selectedAuthor` and `text_uid` matches the collection?
  // Or just return the whole relevant object?
  // SuttaCentral usually returns specific publication info for the translation.
  // We'll iterate publicationMeta to find a match.
  let publicationData = {};
  if (selectedAuthor) {
    // publicationMeta is object with keys like "scpub1", "scpub2"...
    const pubKey = Object.keys(publicationMeta).find((key) => {
      const pub = publicationMeta[key];
      // Simple heuristic: author matches and text_uid matches the start of our Sutta UID?
      // e.g. uid="dn1" -> text_uid="dn"
      // This is imperfect but works for Nikayas.
      const textPrefix = uid.replace(/[0-9\.-].*$/, ""); // "dn1" -> "dn"
      return pub.author_uid === selectedAuthor && pub.text_uid === textPrefix;
    });
    if (pubKey) {
      publicationData = publicationMeta[pubKey];
    }
  }

  res.json({
    uid,
    author_uid: selectedAuthor,
    author_name: getAuthorName(selectedAuthor),
    available_authors: availableAuthors,
    root_text: rootData,
    translation_text: translationData,
    html_text: htmlData,
    comment_text: commentData,
    variant_text: variantData,
    reference_text: referenceData,
    publication_data: publicationData,
  });
});

// Route: Trigger Offline Build Pipeline

/**
 * @openapi
 * /api/admin/build-offline:
 *   post:
 *     tags: [Admin]
 *     summary: Trigger the offline data build pipeline
 *     description: Starts the asynchronous process of pulling data from Git repositories, fetching menu structures, downloading legacy fallbacks, and generating the final offline zip bundle.
 *     responses:
 *       202:
 *         description: Build pipeline started successfully.
 *       409:
 *         description: A build process is already in progress.
 *       500:
 *         description: Internal error starting the build script.
 */
app.post("/api/admin/build-offline", (req, res) => {
  if (buildProcess && !buildProcess.killed && buildProcess.exitCode === null) {
    return res
      .status(409)
      .json({ error: "A build process is already running." });
  }

  triggerOfflineBuild();

  if (!buildProcess) {
    return res.status(500).json({ error: "Build script not found." });
  }

  res.status(202).json({ message: "Build pipeline started asynchronously." });
});

// Route: Get Build Status/Logs
/**
 * @openapi
 * /api/admin/build-status:
 *   get:
 *     tags: [Admin]
 *     summary: Get build progress and logs
 *     description: Returns the real-time stdout/stderr logs and running state of the building pipeline.
 *     responses:
 *       200:
 *         description: Successfully retrieved build status and recent logs.
 */
app.get("/api/admin/build-status", (req, res) => {
  const isRunning = buildProcess !== null;
  res.json({
    isRunning,
    logs: buildLogs,
  });
});

// Route: Download the Zip file
/**
 * @openapi
 * /api/public/download-data:
 *   get:
 *     tags: [Public]
 *     summary: Download the offline data bundle
 *     description: Serves the latest generated `data.zip` file containing the entire offline dataset.
 *     responses:
 *       200:
 *         description: ZIP file download initiated.
 *       404:
 *         description: The data bundle hasn't been generated yet.
 */
app.get("/api/public/download-data", (req, res) => {
  const zipPath = path.join(__dirname, "public/data.zip");

  if (fs.existsSync(zipPath)) {
    res.download(zipPath, "data.zip");
  } else {
    res.status(404).json({
      error:
        "Offline data bundle not found. Please run the build pipeline first.",
    });
  }
});

// Route: Download/View Version Data JSON
/**
 * @openapi
 * /api/public/data-version:
 *   get:
 *     tags: [Public]
 *     summary: Get data version information
 *     description: Returns the Git commit hash and timestamp of the data currently served in the offline bundle.
 *     responses:
 *       200:
 *         description: Successfully retrieved version metadata.
 *       404:
 *         description: Version information not found.
 */
app.get("/api/public/data-version", (req, res) => {
  const versionPath = path.join(__dirname, "public/data.json");

  if (fs.existsSync(versionPath)) {
    res.sendFile(versionPath);
  } else {
    res.status(404).json({
      error: "Version data not found. Please run the build pipeline first.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
