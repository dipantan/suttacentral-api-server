# Expo Offline Sutta App Architecture (SDK 56 Optimized)

This plan details how to build a high-performance offline reader leveraging the new features in **Expo SDK 56**.

## 🛠️ System Overview

1. **Sync Engine**: Uses the new SDK 56 `DownloadTask` for resilient, resumable data fetching.
2. **FileSystem Store**: Flat-file storage for thousands of segmented JSON suttas.
3. **SQLite Index**: Powered by the improved `expo-sqlite` with native ArrayBuffer and session support.
4. **Universal UI**: Uses built-in `BottomSheet` and native primitives for the reader interface.

---

## 📂 File Structure (Device)
```text
/Documents
  /sutta_data/            <-- The extracted ZIP content
    /menus/               <-- Root and sub-menus
    /bilara-data/...      <-- Thousands of segmented JSONs
    sutta_index.json      <-- The master index from the server
  sutta_db.sqlite         <-- Your local SQLite database
```

---

## 🧬 Key Logic Components

### A. The Sync Service (`SyncService.js`)
*Optimized for SDK 56: GitHub Release syncing and version checking.*

```javascript
import { FileSystem } from 'expo-file-system';
import { unzip } from 'expo-zip-archive';

const RELEASE_BASE = "https://github.com/dipantan/suttacentral-api-server/releases/latest/download";
const DATA_URL = `${RELEASE_BASE}/data.zip`;
const VERSION_URL = `${RELEASE_BASE}/data.json`;

const ZIP_PATH = `${FileSystem.cacheDirectory}data.zip`;
const VERSION_PATH = `${FileSystem.documentDirectory}sutta_data/version.json`;
const TARGET_DIR = `${FileSystem.documentDirectory}sutta_data/`;

export const checkForUpdates = async () => {
  // 1. Fetch latest version metadata from GitHub
  const response = await fetch(VERSION_URL);
  const latest = await response.json();

  // 2. Compare with local version
  if (await FileSystem.getInfoAsync(VERSION_PATH).exists) {
    const local = JSON.parse(await FileSystem.readAsStringAsync(VERSION_PATH));
    if (local.commit === latest.commit) {
      console.log("Data is already up to date.");
      return false; // No update needed
    }
  }
  return latest; // Update available
};

export const syncData = async (onProgress) => {
  const updateInfo = await checkForUpdates();
  if (!updateInfo) return;

  // 3. Create a Resumable Download Task for the 50MB+ Zip
  const downloadTask = FileSystem.createDownloadTask(DATA_URL, ZIP_PATH);

  downloadTask.subscribe((progress) => {
    const percent = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
    onProgress(percent);
  });

  const { uri } = await downloadTask.downloadAsync();

  // 4. Extract
  await unzip(uri, TARGET_DIR);

  // 5. Save the version metadata locally
  await FileSystem.writeAsStringAsync(VERSION_PATH, JSON.stringify(updateInfo));

  // 6. Populate SQLite
  await populateIndex();
};
```

### B. The Indexer (`DataService.js`)
*Uses optimized SDK 56 Bind Parameters.*

```javascript
import * as SQLite from 'expo-sqlite';
import { FileSystem } from 'expo-file-system';

const db = SQLite.openDatabaseSync('sutta_db.sqlite');

export const populateIndex = async () => {
  const indexPath = `${FileSystem.documentDirectory}sutta_data/sutta_index.json`;
  const rawIndex = await FileSystem.readAsStringAsync(indexPath);
  const data = JSON.parse(rawIndex);

  db.withTransactionSync(() => {
    // Improved bind param performance in SDK 56
    const statement = db.prepareSync(
      'INSERT OR REPLACE INTO sutta_index (uid, file_path) VALUES (?, ?)'
    );
    
    try {
      Object.entries(data).forEach(([uid, entry]) => {
        statement.executeSync([uid, entry.translations?.sujato || entry.root]);
      });
    } finally {
      statement.finalizeSync();
    }
  });
};
```

### C. Universal Reader UI (`ReaderView.tsx`)
*Leveraging Expo UI (Stable in SDK 56).*

```tsx
import { Host, Text, Column, BottomSheet } from '@expo/ui';

export const ReaderView = ({ content }) => {
  return (
    <Host>
      <Column padding={16}>
        <Text variant="titleLarge">{content.title}</Text>
        {/* Render segmented text here */}
      </Column>

      {/* Built-in BottomSheet for Reader Settings (New in SDK 56) */}
      <BottomSheet id="settings" title="Reader Settings">
         <Text>Adjust font size and themes here...</Text>
      </BottomSheet>
    </Host>
  );
};
```

---

## 🚀 SDK 56 Performance Benefits

1. **Hermes V1**: Default engine now provides faster startup and lower memory footprint when parsing many JSON files.
2. **Native Module Speed**: Cold starts are ~40% faster on Android due to new build-time code generation.
3. **Resilient Downloads**: If the user backgrounds the app during sync, the SDK 56 DownloadTask can continue or resume gracefully.

---

## ✅ Next Steps
1. **Initialize Expo project**: `npx create-expo-app MySuttaApp`
2. **Install dependencies**: `npx expo install expo-file-system expo-sqlite expo-zip-archive @expo/ui`
3. **Check AGENTS.md**: SDK 56 creates this file to help AI assistants (like me) work better with your code!
