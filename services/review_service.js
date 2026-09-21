const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getSuttaTemplate, getRootSegments, getReferenceSegments } = require("./template_service");

const STAGING_DIR = path.join(__dirname, "../data/translations_staging");
const BILARA_BASE = path.join(__dirname, "../data/bilara-data-published");
const SUTTA_INDEX_PATH = path.join(__dirname, "../data/generated/sutta_index.json");
const AUTHOR_META_PATH = path.join(BILARA_BASE, "_author.json");

// Ensure staging directory exists
if (!fs.existsSync(STAGING_DIR)) {
  fs.mkdirSync(STAGING_DIR, { recursive: true });
}

function getReviewFilePath(token) {
  return path.join(STAGING_DIR, `${token}.json`);
}

/**
 * Creates or updates a staging review.
 */
function createReview({
  uid,
  lang = "bn",
  lang_name = "Bengali",
  author_uid,
  author_name,
  segments = {},
  segment_statuses = {},
  source_filename = null,
  raw_text = "",
  translated_title = "",
}) {
  const token = crypto.randomBytes(16).toString("hex");
  const template = getSuttaTemplate(uid);
  const now = new Date().toISOString();

  // If segments provided without statuses, mark as 'ai'
  const initialStatuses = { ...segment_statuses };
  for (const segId of Object.keys(segments)) {
    if (!initialStatuses[segId]) {
      initialStatuses[segId] = "ai";
    }
  }

  const reviewData = {
    token,
    uid: template.uid,
    acronym: template.acronym,
    root_name: template.root_name,
    translated_title: translated_title || template.translated_name,
    breadcrumbs: template.breadcrumbs,
    full_breadcrumb: template.full_breadcrumb,
    lang,
    lang_name,
    author_uid: author_uid || "community",
    author_name: author_name || "Community Contributor",
    status: Object.keys(segments).length > 0 ? "aligned" : "draft",
    source_filename,
    raw_text_length: raw_text.length,
    segments,
    segment_statuses: initialStatuses,
    notes: "",
    created_at: now,
    updated_at: now,
    published_at: null,
  };

  fs.writeFileSync(getReviewFilePath(token), JSON.stringify(reviewData, null, 2), "utf8");
  return reviewData;
}

/**
 * Loads a review by token.
 */
function getReview(token) {
  const filePath = getReviewFilePath(token);
  if (!fs.existsSync(filePath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const rootSegments = getRootSegments(data.uid);
    const refSegments = getReferenceSegments(data.uid);

    // Combine segment lists into full 3-column rows
    const allKeys = Array.from(
      new Set([
        ...Object.keys(rootSegments),
        ...Object.keys(refSegments),
        ...Object.keys(data.segments || {}),
      ])
    );

    const rows = allKeys.map((segId) => ({
      segId,
      root: rootSegments[segId] || "",
      ref: refSegments[segId] || "",
      target: data.segments[segId] || "",
      status: data.segment_statuses[segId] || (data.segments[segId] ? "ai" : "empty"),
    }));

    return {
      ...data,
      total_segments: allKeys.length,
      translated_segments_count: Object.keys(data.segments || {}).filter((k) => (data.segments[k] || "").trim() !== "").length,
      rows,
    };
  } catch (e) {
    console.error("Error reading review:", e);
    return null;
  }
}

/**
 * Updates a single segment in a review.
 */
function updateSegment(token, segId, text, status = "edited") {
  const filePath = getReviewFilePath(token);
  if (!fs.existsSync(filePath)) return null;

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!data.segments) data.segments = {};
  if (!data.segment_statuses) data.segment_statuses = {};

  data.segments[segId] = text;
  data.segment_statuses[segId] = status;
  data.updated_at = new Date().toISOString();
  if (data.status === "aligned") {
    data.status = "in_review";
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  return { segId, text, status };
}

/**
 * Updates metadata for a review (title, notes, status, author name).
 */
function updateReviewMeta(token, updates = {}) {
  const filePath = getReviewFilePath(token);
  if (!fs.existsSync(filePath)) return null;

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (updates.translated_title !== undefined) data.translated_title = updates.translated_title;
  if (updates.author_name !== undefined) data.author_name = updates.author_name;
  if (updates.notes !== undefined) data.notes = updates.notes;
  if (updates.status !== undefined) data.status = updates.status;
  data.updated_at = new Date().toISOString();

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  return data;
}

/**
 * Approves a review.
 */
function approveReview(token) {
  return updateReviewMeta(token, { status: "approved" });
}

/**
 * Publishes an approved review directly to the Bilara dataset.
 */
function publishReview(token) {
  const filePath = getReviewFilePath(token);
  if (!fs.existsSync(filePath)) {
    throw new Error("Review not found for token: " + token);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const template = getSuttaTemplate(data.uid);

  if (!template.root_rel_path) {
    throw new Error(`Cannot locate root path for sutta ${data.uid}`);
  }

  // Derive target path relative to translation directory
  // e.g. root_rel_path is "sutta/mn/mn1_root-pli-ms.json"
  // target filename is "sutta/mn/mn1_translation-{lang}-{author_uid}.json"
  const subPath = path.dirname(template.root_rel_path);
  const targetFilename = `${data.uid}_translation-${data.lang}-${data.author_uid}.json`;
  const targetDir = path.join(BILARA_BASE, `translation/${data.lang}/${data.author_uid}`, subPath);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetFullPath = path.join(targetDir, targetFilename);

  // Write sorted segments
  const cleanSegments = {};
  const sortedKeys = Object.keys(data.segments || {}).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  for (const k of sortedKeys) {
    const val = (data.segments[k] || "").trim();
    if (val) {
      cleanSegments[k] = val + " ";
    }
  }

  fs.writeFileSync(targetFullPath, JSON.stringify(cleanSegments, null, 2), "utf8");
  console.log(`✅ Published translation to: ${targetFullPath}`);

  // Register author in _author.json if not present
  try {
    let authorMeta = {};
    if (fs.existsSync(AUTHOR_META_PATH)) {
      authorMeta = JSON.parse(fs.readFileSync(AUTHOR_META_PATH, "utf8"));
    }
    if (!authorMeta[data.author_uid]) {
      authorMeta[data.author_uid] = {
        name: data.author_name,
        type: "translator",
      };
      fs.writeFileSync(AUTHOR_META_PATH, JSON.stringify(authorMeta, null, 2), "utf8");
    }
  } catch (e) {
    console.error("Error updating author metadata:", e);
  }

  // Update sutta_index.json
  try {
    if (fs.existsSync(SUTTA_INDEX_PATH)) {
      const suttaIndex = JSON.parse(fs.readFileSync(SUTTA_INDEX_PATH, "utf8"));
      if (!suttaIndex[data.uid]) {
        suttaIndex[data.uid] = { root: template.root_rel_path, translations: {} };
      }
      if (!suttaIndex[data.uid].translations) {
        suttaIndex[data.uid].translations = {};
      }
      // Store relative path from author directory
      const relFromAuthor = path.join(subPath, targetFilename).replace(/\\/g, "/");
      suttaIndex[data.uid].translations[data.author_uid] = relFromAuthor;
      fs.writeFileSync(SUTTA_INDEX_PATH, JSON.stringify(suttaIndex), "utf8");
    }
  } catch (e) {
    console.error("Error updating sutta_index:", e);
  }

  data.status = "published";
  data.published_at = new Date().toISOString();
  data.updated_at = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

  return {
    success: true,
    target_path: targetFullPath,
    status: "published",
  };
}

/**
 * Lists all reviews in staging.
 */
function listReviews() {
  const files = fs.readdirSync(STAGING_DIR).filter((f) => f.endsWith(".json"));
  const reviews = [];

  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(STAGING_DIR, f), "utf8");
      const d = JSON.parse(content);
      const totalSegs = Object.keys(d.segments || {}).length;
      reviews.push({
        token: d.token,
        uid: d.uid,
        acronym: d.acronym,
        root_name: d.root_name,
        translated_title: d.translated_title,
        full_breadcrumb: d.full_breadcrumb,
        lang: d.lang,
        lang_name: d.lang_name,
        author_uid: d.author_uid,
        author_name: d.author_name,
        status: d.status,
        segment_count: totalSegs,
        created_at: d.created_at,
        updated_at: d.updated_at,
        published_at: d.published_at,
      });
    } catch (e) {
      // Ignore corrupted files
    }
  }

  // Sort by updated_at descending
  reviews.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return reviews;
}

module.exports = {
  createReview,
  getReview,
  updateSegment,
  updateReviewMeta,
  approveReview,
  publishReview,
  listReviews,
};
