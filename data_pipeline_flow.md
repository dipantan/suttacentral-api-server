# Data Pipeline: End-to-End Flow

The data pipeline is orchestrated by `scripts/build_pipeline.js`. It transforms raw scripture data into a processed, indexed, and compressed format suitable for offline use.

## 🔄 Execution Flow

### Step 1: Git Syncing
- **Script**: `build_pipeline.js` (internal logic)
- **Action**: Performs a shallow clone or pull of the `suttacentral/bilara-data` repository (branch: `published`).
- **Target**: `data/bilara-data-published/`

### Step 2: Version Capturing
- **Action**: Records the latest Git commit hash and date. This information is saved to `public/data.json` to help client apps determine if they need to update.

### Step 3: Menu Fetching
- **Script**: `scripts/master_fetch.js`
- **Action**: Connects to the live SuttaCentral API to download the latest navigation structures (Menus).
- **Target**: `data/menus/`

### Step 4: Bilara Cleanup
- **Script**: `scripts/cleanup_bilara.js`
- **Action**: Prunes the cloned repository of unnecessary files (like metadata and non-published drafts) to keep the offline bundle size manageable.

### Step 5: Sutta Indexing
- **Script**: `scripts/build_index.js`
- **Action**: Scans all JSON files in the Bilara directory. It maps Sutta UIDs to their specific file paths for Pali text and various translations.
- **Target**: `data/generated/sutta_index.json`

### Step 6: Legacy Content Fetching
- **Script**: `scripts/fetch_legacy.js`
- **Action**: SuttaCentral has many suttas that aren't yet in the new "Bilara" format. This script fetches these "legacy" suttas as fallbacks.
- **Target**: `data/bilara-data-published/legacy/`

### Step 7: Zip Bundle Generation
- **Script**: `scripts/generate_data_bundle.js`
- **Action**: Collects all processed JSON files (Suttas, Menus, Index) and compresses them into a single archive.
- **Target**: `public/data.zip`

---

## 🛠 How to Run
The entire pipeline can be triggered in two ways:
1. **Command Line**: `node scripts/build_pipeline.js`
2. **API**: `POST http://localhost:3000/api/admin/build-offline` (runs asynchronously)
