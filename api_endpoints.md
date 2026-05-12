# SuttaCentral Offline API Endpoints

This document outlines the available API endpoints for the SuttaCentral Offline server. The base URL is typically `http://localhost:3000`.

## 📚 API Documentation
- **Swagger UI**: `GET /api-docs`
  - Provides an interactive interface to test all endpoints.

---

## 🗺️ Navigation & Menus
Used to build the site navigation and collection hierarchies.

### 1. Get Root Menu
- **Endpoint**: `GET /api/menu`
- **Description**: Returns the top-level categories (e.g., Sutta, Vinaya, Abhidhamma).
- **Response**: Array of menu objects.

### 2. Get Sub-Menu
- **Endpoint**: `GET /api/menu/{uid}`
- **Description**: Returns the recursive menu structure for a specific collection (e.g., `dn`, `sn`).
- **Parameters**: `uid` (string) - The collection ID.

---

## 📖 Sutta Content
Endpoints for retrieving scripture text and metadata.

### 3. Get Suttaplex (Translations List)
- **Endpoint**: `GET /api/suttaplex/{uid}`
- **Description**: Lists all available translations, authors, and languages for a specific sutta.
- **Parameters**: `uid` (string) - The sutta ID (e.g., `dn1`).

### 4. Get Full Sutta Content
- **Endpoint**: `GET /api/suttas/{uid}`
- **Description**: Retrieves the complete content for a sutta.
- **Parameters**:
  - `uid` (string) - The sutta ID (e.g., `sn1.1`).
  - `author` (query, optional) - Specific author UID (e.g., `sujato`). Defaults to Sujato or Brahmali if available.
- **Returns**: A JSON object containing:
  - `root_text`: Segmented Pali text.
  - `translation_text`: Segmented translation.
  - `html_text`: HTML structure segments.
  - `comment_text`: Scholarly comments (if available).
  - `variant_text`: Textual variants.
  - `reference_text`: External references (e.g., PTS page numbers).
  - `publication_data`: Publisher and license metadata.

---

## ⚙️ Admin & Maintenance
Used for managing the local data state.

### 5. Trigger Offline Build
- **Endpoint**: `POST /api/admin/build-offline`
- **Description**: Starts the end-to-end data pipeline (Sync -> Index -> Bundle).
- **Response**: `202 Accepted`.

### 6. Get Build Status
- **Endpoint**: `GET /api/admin/build-status`
- **Description**: Returns the running state and real-time logs of the build process.

---

## 📦 Public Resources
Endpoints for client-side synchronization.

### 7. Download Data Bundle
- **Endpoint**: `GET /api/public/download-data`
- **Description**: Downloads the `data.zip` file containing the entire processed dataset.

### 8. Get Data Version
- **Endpoint**: `GET /api/public/data-version`
- **Description**: Returns the Git commit hash and timestamp of the data currently being served.
