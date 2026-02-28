# SuttaCentral Offline API Server

This is the server-side component for the SuttaCentral Offline data pipeline and API. It provides endpoints for accessing Buddhist scriptures (Suttas), menu navigation, and managing the offline data synchronization process.

## 🚀 Features

- **Offline First**: Designed to serve Sutta data without requiring an active internet connection.
- **Automated Data Pipeline**: Syncs with SuttaCentral's `bilara-data` repository and builds a local index.
- **Rich Sutta Content**: Provides segmented Pali root text, translations (defaulting to Bhikkhu Sujato/Bhikkhu Brahmali), HTML structure, and scholarly metadata.
- **Swagger Documentation**: Built-in API explorer for easy testing and integration.
- **ZIP Bundle Generation**: Can generate a compressed data bundle for PWA/client-side consumption.

## 🛠 Tech Stack

- **Environment**: Node.js
- **Framework**: Express (@5.2.1)
- **Documentation**: Swagger (swagger-ui-express, swagger-jsdoc)
- **Cloning/Sync**: Local Git integration via child processes.

## 📦 Getting Started

### Prerequisites

- Node.js installed.
- Git CLI installed and configured.

### Installation

1.  Clone this repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the Server

- **Development mode** (with hot reload):
  ```bash
  npm run dev
  ```
- **Production mode**:
  ```bash
  npm start
  ```

The server will be available at `http://localhost:3000`.

## 📖 API Documentation

The server includes an interactive Swagger UI. Once the server is running, visit:
`http://localhost:3000/api-docs`

### Key Endpoints

#### Sutta Data

- `GET /api/suttas/{uid}`: Get full sutta content (Root + Translation + Metadata).
- `GET /api/suttaplex/{uid}`: Get available translations/authors for a sutta.
- `GET /api/menu`: Get the root navigation menu.

#### Admin & Maintenance

- `POST /api/admin/build-offline`: Trigger the full data sync and index build pipeline.
- `GET /api/admin/build-status`: View real-time logs of the build process.

#### Public Resources

- `GET /api/public/download-data`: Download the latest `data.zip` bundle.
- `GET /api/public/data-version`: Check current Git commit and update timestamp.

## 📁 Project Structure

- `app.js`: Main server entry point and API definitions.
- `scripts/`: Automation scripts for the data pipeline.
  - `build_pipeline.js`: Orchestrates the entire data preparation process.
  - `master_fetch.js`: Fetches menu structures from SuttaCentral's live API.
  - `build_index.js`: Creates a searchable index of local Bilara files.
- `data/`: (Local only) Storage for Git repositories and generated JSON files.

## 📜 License

MIT
