/**
 * One-time migration: uploads staged reviews and studio-published artifacts
 * to the configured R2 bucket. Run with R2_* env vars set:
 *   node scripts/seed_r2.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const r2 = require("../services/r2_storage");
const { getSuttaTemplate } = require("../services/template_service");

const STAGING_DIR = path.join(__dirname, "../data/translations_staging");
const BILARA_BASE = path.join(__dirname, "../data/bilara-data-published");
const GENERATED_DIR = path.join(__dirname, "../data/generated");

async function seed() {
  if (!r2.enabled) {
    console.error("R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.");
    process.exit(1);
  }

  let count = 0;

  // Staged reviews
  const staged = fs.readdirSync(STAGING_DIR).filter((f) => f.endsWith(".json"));
  for (const f of staged) {
    await r2.uploadFile(`staging/${f}`, path.join(STAGING_DIR, f));
    count++;
  }
  console.log(`Uploaded ${staged.length} staged reviews.`);

  // Studio-published translations only (not the upstream dataset)
  for (const f of staged) {
    const review = JSON.parse(fs.readFileSync(path.join(STAGING_DIR, f), "utf8"));
    if (review.status !== "published") continue;
    const template = getSuttaTemplate(review.uid);
    if (!template.root_rel_path) continue;
    const rel = path.join(
      `translation/${review.lang}/${review.author_uid}`,
      path.dirname(template.root_rel_path),
      `${review.uid}_translation-${review.lang}-${review.author_uid}.json`
    ).replace(/\\/g, "/");
    const full = path.join(BILARA_BASE, rel);
    if (fs.existsSync(full)) {
      await r2.uploadFile(`bilara/${rel}`, full);
      count++;
      console.log(`  published: ${rel}`);
    }
  }

  // Bilara metadata + generated index
  for (const meta of ["_author.json", "_publication.json"]) {
    const p = path.join(BILARA_BASE, meta);
    if (fs.existsSync(p)) {
      await r2.uploadFile(`bilara/${meta}`, p);
      count++;
    }
  }
  const idx = path.join(GENERATED_DIR, "sutta_index.json");
  if (fs.existsSync(idx)) {
    await r2.uploadFile("generated/sutta_index.json", idx);
    count++;
  }

  console.log(`✅ Seeded ${count} files to R2.`);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
