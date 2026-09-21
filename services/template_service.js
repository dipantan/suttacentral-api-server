const fs = require("fs");
const path = require("path");

const MENUS_DIR = path.join(__dirname, "../data/menus");
const BILARA_BASE = path.join(__dirname, "../data/bilara-data-published");

// In-memory cache for fast lookup
let suttasCatalog = null;
let suttasMap = null;

/**
 * Traverses all menu JSON files and indexes every leaf sutta with its parent hierarchy.
 */
function loadSuttaTaxonomy() {
  if (suttasCatalog && suttasMap) {
    return { catalog: suttasCatalog, map: suttasMap };
  }

  const catalog = [];
  const map = new Map();

  if (!fs.existsSync(MENUS_DIR)) {
    console.warn("⚠️ Menus directory not found at:", MENUS_DIR);
    return { catalog: [], map: new Map() };
  }

  // Load all menu files
  const files = fs.readdirSync(MENUS_DIR).filter((f) => f.endsWith(".json"));
  const rawMenus = new Map();

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(MENUS_DIR, file), "utf8");
      const data = JSON.parse(content);
      if (data && data.uid) {
        rawMenus.set(data.uid, data);
      }
    } catch (e) {
      // Ignore individual corrupted files
    }
  }

  // Helper to build ancestors and traverse nodes
  function traverse(node, breadcrumbs = []) {
    if (!node) return;

    const currentCrumb = {
      uid: node.uid,
      root_name: node.root_name || "",
      translated_name: (node.translated_name || "").trim(),
      acronym: node.acronym || null,
    };

    const newBreadcrumbs = [...breadcrumbs, currentCrumb];

    if (node.node_type === "leaf" || (node.children && node.children.length === 0)) {
      const suttaItem = {
        uid: node.uid,
        acronym: node.acronym || node.uid.toUpperCase(),
        root_name: node.root_name || "",
        translated_name: (node.translated_name || "").trim(),
        blurb: node.blurb || "",
        breadcrumbs: breadcrumbs, // Ancestor chain
        full_breadcrumb: newBreadcrumbs.map((b) => b.translated_name || b.root_name || b.uid).join(" > "),
      };

      if (!map.has(node.uid)) {
        map.set(node.uid, suttaItem);
        catalog.push(suttaItem);
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        // Child can either be an embedded object or reference to another menu file
        if (typeof child === "string" && rawMenus.has(child)) {
          traverse(rawMenus.get(child), newBreadcrumbs);
        } else if (typeof child === "object" && child.uid) {
          // If child has no children property or is a branch, check if expanded in rawMenus
          if ((!child.children || child.children.length === 0) && rawMenus.has(child.uid)) {
            traverse(rawMenus.get(child.uid), newBreadcrumbs);
          } else {
            traverse(child, newBreadcrumbs);
          }
        }
      }
    }
  }

  // Start traversing from primary root nikayas
  const ROOT_MENUS = ["dn", "mn", "sn", "an", "kn", "pli-tv-vi", "abhidhamma"];
  for (const rootId of ROOT_MENUS) {
    if (rawMenus.has(rootId)) {
      traverse(rawMenus.get(rootId), []);
    }
  }

  // Check any remaining unvisited files to ensure full coverage
  for (const [uid, node] of rawMenus.entries()) {
    if (!ROOT_MENUS.includes(uid)) {
      traverse(node, []);
    }
  }

  // Sort catalog naturally (e.g. mn1, mn2, ...)
  catalog.sort((a, b) => a.uid.localeCompare(b.uid, undefined, { numeric: true }));

  suttasCatalog = catalog;
  suttasMap = map;
  console.log(`Indexed ${catalog.length} canonical suttas for template service.`);
  return { catalog, map };
}

/**
 * Finds the relative file path for a sutta's Pāli root text.
 */
function findRootPath(uid) {
  const rootDir = path.join(BILARA_BASE, "root/pli/ms");
  if (!fs.existsSync(rootDir)) return null;

  function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else if (f === `${uid}_root-pli-ms.json`) {
        return path.relative(rootDir, full).replace(/\\/g, "/");
      }
    }
    return null;
  }

  return walk(rootDir);
}

/**
 * Finds the relative file path for a sutta's English reference translation (Sujato).
 */
function findTranslationPath(uid, author = "sujato", lang = "en") {
  const transDir = path.join(BILARA_BASE, `translation/${lang}/${author}`);
  if (!fs.existsSync(transDir)) return null;

  function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else if (f === `${uid}_translation-${lang}-${author}.json`) {
        return path.relative(transDir, full).replace(/\\/g, "/");
      }
    }
    return null;
  }

  return walk(transDir);
}

/**
 * Reads root Pāli segments for a given UID.
 */
function getRootSegments(uid) {
  const rootRel = findRootPath(uid);
  if (!rootRel) return {};
  const fullPath = path.join(BILARA_BASE, "root/pli/ms", rootRel);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (e) {
    console.error(`Error reading root segments for ${uid}:`, e);
    return {};
  }
}

/**
 * Reads English reference segments for a given UID.
 */
function getReferenceSegments(uid, author = "sujato", lang = "en") {
  const transRel = findTranslationPath(uid, author, lang);
  if (!transRel) return {};
  const fullPath = path.join(BILARA_BASE, `translation/${lang}/${author}`, transRel);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (e) {
    console.error(`Error reading reference segments for ${uid}:`, e);
    return {};
  }
}

/**
 * Returns full template information for a sutta.
 */
function getSuttaTemplate(uid) {
  const { map } = loadSuttaTaxonomy();
  const lowerUid = uid.toLowerCase().trim();
  const meta = map.get(lowerUid) || {
    uid: lowerUid,
    acronym: lowerUid.toUpperCase(),
    root_name: lowerUid,
    translated_name: "",
    blurb: "",
    breadcrumbs: [],
    full_breadcrumb: "",
  };

  const rootRel = findRootPath(lowerUid);
  const transRel = findTranslationPath(lowerUid);
  const rootSegments = getRootSegments(lowerUid);
  const refSegments = getReferenceSegments(lowerUid);
  const segmentKeys = Object.keys(rootSegments);

  return {
    ...meta,
    root_rel_path: rootRel,
    ref_rel_path: transRel,
    segment_count: segmentKeys.length,
    sample_segments: segmentKeys.slice(0, 5).map((key) => ({
      key,
      root: rootSegments[key] || "",
      ref: refSegments[key] || "",
    })),
  };
}

/**
 * Returns all suttas catalog for search/dropdown.
 */
function getAllSuttasCatalog() {
  const { catalog } = loadSuttaTaxonomy();
  return catalog.map((c) => ({
    uid: c.uid,
    acronym: c.acronym,
    root_name: c.root_name,
    translated_name: c.translated_name,
    full_breadcrumb: c.full_breadcrumb,
  }));
}

module.exports = {
  loadSuttaTaxonomy,
  getSuttaTemplate,
  getAllSuttasCatalog,
  getRootSegments,
  getReferenceSegments,
  findRootPath,
  findTranslationPath,
};
