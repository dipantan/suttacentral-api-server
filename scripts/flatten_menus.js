const fs = require("fs");
const path = require("path");

const MENUS_DIR = path.join(__dirname, "../data/menus");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      /* Recurse into a subdirectory */
      results = results.concat(walk(file));
    } else {
      /* Is a file */
      if (file.endsWith(".json") && path.dirname(file) !== MENUS_DIR) {
        results.push(file);
      }
    }
  });
  return results;
}

try {
  const filesToMove = walk(MENUS_DIR);
  console.log(`Found ${filesToMove.length} files to move.`);

  filesToMove.forEach((file) => {
    const fileName = path.basename(file);
    const dest = path.join(MENUS_DIR, fileName);

    if (fs.existsSync(dest)) {
      console.warn(
        `Warning: File ${fileName} already exists in root menus/. Overwriting.`
      );
    }

    fs.renameSync(file, dest);
  });

  console.log("Files moved. Removing empty directories...");

  // Function to remove empty directories
  // We need to re-crawl or just try to remove known dirs roughly or just use a generic cleanup.
  // A simple way is to walk directories and remove them if empty, bottom-up.
  // Or just run this logic:

  function removeEmptyDirs(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    if (files.length > 0) {
      files.forEach((file) => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          removeEmptyDirs(fullPath);
        }
      });
    }

    // Check again if empty
    if (fs.readdirSync(dir).length === 0 && dir !== MENUS_DIR) {
      fs.rmdirSync(dir);
      console.log(`Removed empty dir: ${dir}`);
    }
  }

  removeEmptyDirs(MENUS_DIR);
  console.log("Flattening complete.");
} catch (err) {
  console.error("Error flattening menus:", err);
}
