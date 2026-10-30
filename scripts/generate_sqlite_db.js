const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const JSZip = require("jszip");

const SERVER_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(SERVER_DIR, "data");
const PUBLIC_DIR = path.join(SERVER_DIR, "public");
const BILARA_DIR = path.join(DATA_DIR, "bilara-data-published");
const MENUS_DIR = path.join(DATA_DIR, "menus");
const SUTTA_INDEX_PATH = path.join(DATA_DIR, "generated/sutta_index.json");

const SQLITE_FILE = path.join(PUBLIC_DIR, "sutta_db.sqlite");
const SQLITE_ZIP_FILE = path.join(PUBLIC_DIR, "sutta_db.zip");

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
}

function parseLegacyHtmlToSegments(uid, html) {
  if (!html) return {};
  const regex = /<(p|h1|h2|h3|li)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;
  const paragraphs = [];
  while ((match = regex.exec(html)) !== null) {
    let tag = match[1].toLowerCase();
    const attrs = match[2];
    const text = match[3]
      .replace(/<a[^>]*>[^<]*<\/a>/gi, "")
      .replace(/<\/?[^>]+(>|$)/g, "")
      .trim();
    if (text.length > 0) {
      if (tag === "li" && attrs.includes("division")) tag = "division";
      paragraphs.push({ tag, text });
    }
  }
  const translationText = {};
  paragraphs.forEach((p, idx) => {
    translationText[`${uid}:legacy:${p.tag}:${idx + 1}`] = p.text;
  });
  return translationText;
}

function extractMetadataFromMenus() {
  console.log("📂 Parsing menus for metadata and menu tree...");
  const metadataMap = new Map();
  const menusMap = new Map();

  if (!fs.existsSync(MENUS_DIR)) {
    console.warn("⚠️ Menus directory not found:", MENUS_DIR);
    return { metadataMap, menusMap };
  }

  const files = fs.readdirSync(MENUS_DIR);

  const walkMenuNode = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) walkMenuNode(child);
      return;
    }

    if (node.uid) {
      const uid = node.uid;
      if (node.translated_name || node.root_name || node.acronym || node.blurb) {
        let existing = metadataMap.get(uid);
        if (!existing) {
          existing = {};
          metadataMap.set(uid, existing);
        }
        if (node.translated_name) existing.translated_name = node.translated_name.trim();
        if (node.root_name) existing.root_name = node.root_name.trim();
        if (node.acronym) existing.acronym = node.acronym.trim();
        if (node.blurb) existing.blurb = node.blurb.trim();
      }
    }

    if (node.children) {
      walkMenuNode(node.children);
    }
  };

  for (const file of files) {
    if (file.endsWith(".json")) {
      const menuId = file.replace(/\.json$/, "");
      const fullPath = path.join(MENUS_DIR, file);
      try {
        const raw = fs.readFileSync(fullPath, "utf8");
        const parsed = JSON.parse(raw);
        menusMap.set(menuId, JSON.stringify(parsed));
        walkMenuNode(parsed);
      } catch (err) {
        console.error(`Error parsing menu file ${file}:`, err.message);
      }
    }
  }

  console.log(`✅ Parsed metadata for ${metadataMap.size} UIDs and ${menusMap.size} menus.`);
  return { metadataMap, menusMap };
}

async function generateSqliteDb() {
  console.log("\n📦 Starting SQLite Database Generation...");

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  // Remove existing sqlite database if present
  if (fs.existsSync(SQLITE_FILE)) {
    try {
      fs.unlinkSync(SQLITE_FILE);
    } catch (e) {}
  }

  const db = new DatabaseSync(SQLITE_FILE);

  // Set performant PRAGMAs for bulk inserts
  db.exec("PRAGMA journal_mode = OFF;");
  db.exec("PRAGMA synchronous = OFF;");
  db.exec("PRAGMA cache_size = -64000;"); // 64 MB cache

  console.log("🛠️ Creating SQLite tables & FTS5 virtual table...");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sutta_index (
      uid TEXT PRIMARY KEY,
      title TEXT,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sutta_metadata (
      uid TEXT PRIMARY KEY,
      translated_name TEXT,
      root_name TEXT,
      acronym TEXT,
      blurb TEXT
    );

    CREATE TABLE IF NOT EXISTS menus (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sutta_content (
      uid TEXT,
      author_uid TEXT,
      root_text TEXT,
      translation_text TEXT,
      comment_text TEXT,
      html_text TEXT,
      root_lang TEXT,
      PRIMARY KEY (uid, author_uid)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS sutta_fts USING fts5(
      uid,
      root_title,
      translated_title,
      acronym,
      blurb,
      translation_text,
      root_text,
      tokenize = 'unicode61 remove_diacritics 2'
    );
  `);

  // --- Step 1: Menus & Metadata ---
  const { metadataMap, menusMap } = extractMetadataFromMenus();

  console.log("💾 Inserting menus...");
  db.exec("BEGIN TRANSACTION;");
  const insertMenuStmt = db.prepare("INSERT INTO menus (id, data) VALUES (?, ?);");
  for (const [id, data] of menusMap.entries()) {
    insertMenuStmt.run(id, data);
  }
  db.exec("COMMIT;");

  console.log("💾 Inserting metadata...");
  db.exec("BEGIN TRANSACTION;");
  const insertMetaStmt = db.prepare(`
    INSERT INTO sutta_metadata (uid, translated_name, root_name, acronym, blurb)
    VALUES (?, ?, ?, ?, ?);
  `);
  for (const [uid, meta] of metadataMap.entries()) {
    insertMetaStmt.run(
      uid,
      meta.translated_name || null,
      meta.root_name || null,
      meta.acronym || null,
      meta.blurb || null
    );
  }
  db.exec("COMMIT;");

  // --- Step 2: Sutta Index, Content, and FTS ---
  if (!fs.existsSync(SUTTA_INDEX_PATH)) {
    throw new Error(`Master sutta_index not found at: ${SUTTA_INDEX_PATH}`);
  }

  console.log("📄 Reading sutta_index.json...");
  const suttaIndex = JSON.parse(fs.readFileSync(SUTTA_INDEX_PATH, "utf8"));
  const uids = Object.keys(suttaIndex);
  console.log(`Found ${uids.length} suttas in index. Inserting content & building FTS5 index...`);

  const insertIndexStmt = db.prepare("INSERT INTO sutta_index (uid, title, data) VALUES (?, ?, ?);");
  const insertContentStmt = db.prepare(`
    INSERT OR REPLACE INTO sutta_content (uid, author_uid, root_text, translation_text, comment_text, html_text, root_lang)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `);
  const insertFtsStmt = db.prepare(`
    INSERT INTO sutta_fts (uid, root_title, translated_title, acronym, blurb, translation_text, root_text)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `);

  // Cache root texts in memory or load per sutta
  const ROOT_BASE = path.join(BILARA_DIR, "root/pli/ms");
  const TRANS_BASE = path.join(BILARA_DIR, "translation/en");
  const COMMENT_BASE = path.join(BILARA_DIR, "comment/en");

  db.exec("BEGIN TRANSACTION;");

  let processed = 0;
  for (const uid of uids) {
    const entry = suttaIndex[uid];
    const meta = metadataMap.get(uid) || {};

    const title = meta.translated_name || meta.root_name || uid;
    insertIndexStmt.run(uid, title, JSON.stringify(entry));

    // Load root text if present
    let rootSegments = null;
    let rootPlainText = "";
    if (entry.root) {
      const rootPath = path.join(ROOT_BASE, entry.root);
      if (fs.existsSync(rootPath)) {
        try {
          const raw = fs.readFileSync(rootPath, "utf8");
          rootSegments = JSON.parse(raw);
          rootPlainText = Object.values(rootSegments).map(v => stripHtml(String(v))).join(" ");
        } catch (e) {}
      }
    }

    // Determine author & load translations
    const translations = entry.translations || {};
    const authors = Object.keys(translations);

    let primaryTransPlainText = "";

    if (authors.length === 0) {
      // Root only, or non-English
      if (rootSegments) {
        insertContentStmt.run(
          uid,
          "ms",
          JSON.stringify(rootSegments),
          JSON.stringify({}),
          JSON.stringify({}),
          null,
          "pli"
        );
      }
    } else {
      // Loop authors or handle default
      for (const author of authors) {
        const transRelPath = translations[author];
        let transSegments = {};
        let commentSegments = {};
        let htmlContent = null;
        let transPlainText = "";

        if (transRelPath.endsWith(".html")) {
          // Legacy HTML file
          const legacyFullPath = path.join(BILARA_DIR, transRelPath);
          if (fs.existsSync(legacyFullPath)) {
            try {
              const html = fs.readFileSync(legacyFullPath, "utf8");
              htmlContent = html;
              transSegments = parseLegacyHtmlToSegments(uid, html);
              transPlainText = Object.values(transSegments).join(" ");
            } catch (e) {}
          }
        } else {
          // Standard Bilara translation JSON
          const transFullPath = path.join(TRANS_BASE, author, transRelPath);
          if (fs.existsSync(transFullPath)) {
            try {
              const raw = fs.readFileSync(transFullPath, "utf8");
              transSegments = JSON.parse(raw);
              transPlainText = Object.values(transSegments).map(v => stripHtml(String(v))).join(" ");
            } catch (e) {}
          }

          // Check corresponding comment JSON
          const commentFilename = transRelPath.replace("_translation-en-", "_comment-en-");
          const commentFullPath = path.join(COMMENT_BASE, author, commentFilename);
          if (fs.existsSync(commentFullPath)) {
            try {
              const raw = fs.readFileSync(commentFullPath, "utf8");
              commentSegments = JSON.parse(raw);
            } catch (e) {}
          }
        }

        if (author === "sujato" || !primaryTransPlainText) {
          primaryTransPlainText = transPlainText;
        }

        insertContentStmt.run(
          uid,
          author,
          rootSegments ? JSON.stringify(rootSegments) : JSON.stringify({}),
          JSON.stringify(transSegments),
          JSON.stringify(commentSegments),
          htmlContent,
          "pli"
        );
      }
    }

    // Insert into FTS5
    insertFtsStmt.run(
      uid,
      meta.root_name || "",
      meta.translated_name || "",
      meta.acronym || "",
      stripHtml(meta.blurb || ""),
      primaryTransPlainText,
      rootPlainText
    );

    processed++;
    if (processed % 2000 === 0) {
      console.log(`  - Indexed ${processed}/${uids.length} suttas...`);
    }
  }

  db.exec("COMMIT;");
  console.log(`✅ Finished indexing ${processed} suttas.`);

  // Optimize & Vacuum
  console.log("🧹 Running VACUUM & PRAGMA optimize...");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("VACUUM;");
  db.exec("PRAGMA optimize;");
  db.close();

  const stats = fs.statSync(SQLITE_FILE);
  console.log(`📊 Uncompressed SQLite Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  // Compress SQLite DB with JSZip
  console.log("🗜️ Compressing SQLite database into zip (Level 9)...");
  const zip = new JSZip();
  zip.file("sutta_db.sqlite", fs.createReadStream(SQLITE_FILE));

  await new Promise((resolve, reject) => {
    zip
      .generateNodeStream({
        type: "nodebuffer",
        streamFiles: true,
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
      })
      .pipe(fs.createWriteStream(SQLITE_ZIP_FILE))
      .on("finish", () => {
        const zipStats = fs.statSync(SQLITE_ZIP_FILE);
        console.log(`✅ SQLite zip created at: ${SQLITE_ZIP_FILE}`);
        console.log(`📊 Final Compressed Zip Size: ${(zipStats.size / 1024 / 1024).toFixed(2)} MB`);
        resolve();
      })
      .on("error", (err) => {
        console.error("❌ Error compressing SQLite zip:", err);
        reject(err);
      });
  });

  return SQLITE_ZIP_FILE;
}

if (require.main === module) {
  generateSqliteDb().catch((err) => {
    console.error("🚨 Fatal error in generateSqliteDb:", err);
    process.exit(1);
  });
}

module.exports = {
  generateSqliteDb,
  SQLITE_FILE,
  SQLITE_ZIP_FILE,
};
