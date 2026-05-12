# Chat Conversation

Note: _This is purely the output of the chat conversation and does not contain any raw data, codebase snippets, etc. used to generate the output._

### User Input

please analyze this project and tell me what it contains

*Listed directory [server](file:///e:/Projects/Node/suttacentral-api/server) *

*Viewed [package.json](file:///e:/Projects/Node/suttacentral-api/server/package.json) *

*Viewed [README.md](file:///e:/Projects/Node/suttacentral-api/server/README.md) *

*Listed directory [scripts](file:///e:/Projects/Node/suttacentral-api/server/scripts) *

*Viewed [app.js](file:///e:/Projects/Node/suttacentral-api/server/app.js) *

### Planner Response

This project is the **SuttaCentral Offline API Server**, a Node.js-based Express application designed to provide an offline-first API for accessing Buddhist scriptures (Suttas). It manages a complex data pipeline that syncs with SuttaCentral's `bilara-data` and serves it through a RESTful interface.

### 🏗️ Project Architecture

| Component | Description |
| :--- | :--- |
| **API Server (`app.js`)** | Express server providing endpoints for Sutta content, menus, and admin tasks. |
| **Data Pipeline (`scripts/`)** | Automation scripts that clone repositories, fetch menu structures, and build local search indexes. |
| **Storage (`data/`)** | Local storage for Git repositories (Bilara data), menu JSONs, and generated indexes. |
| **Public Assets (`public/`)** | Contains the generated `data.zip` bundle and versioning metadata for client-side PWAs. |

### 🚀 Key Features

*   **Offline API**: Serves Sutta content (Root Pali + Translations) without an internet connection.
*   **Rich Content**: Integrates segmented text, HTML structure, scholarly comments, and variant readings.
*   **Automated Sync**: A built-in admin endpoint triggers a full rebuild of the data index from upstream Git sources.
*   **Swagger Documentation**: Built-in interactive API explorer available at `/api-docs`.
*   **Bundle Generation**: Can package the entire dataset into a single ZIP for consumption by mobile or web apps.

### 📁 Directory Breakdown

*   **`app.js`**: The main entry point. Defines routes for `/api/suttas`, `/api/menu`, and `/api/admin`.
*   **`scripts/`**:
    *   `build_pipeline.js`: Orchestrates the entire data preparation process.
    *   `master_fetch.js`: Fetches navigation menus from SuttaCentral's live API.
    *   `build_index.js`: Creates a local JSON index of all available Suttas.
    *   `generate_data_bundle.js`: Compresses the processed data into `public/data.zip`.
*   **`data/`**: (Generated) Contains the `bilara-data-published` repo and `generated/sutta_index.json`.

### 🛠️ Tech Stack
*   **Backend**: Node.js, Express 5.2.1
*   **Documentation**: Swagger (swagger-ui-express, swagger-jsdoc)
*   **Utilities**: JSZip for bundle creation, child_process for Git integration.

Would you like me to help you with any specific part of the code or assist in running the data pipeline?