const fs = require("fs");
const path = require("path");

const BILARA_BASE = path.join(__dirname, "../bilara-data-published");

const DIRS_TO_PROCESS = [
  { name: "root", keep: ["pli"] },
  { name: "translation", keep: ["en"] },
  { name: "html", keep: ["pli"] },
  { name: "comment", keep: ["en"] },
  { name: "variant", keep: ["pli"] },
  { name: "reference", keep: ["pli"] },
];

const FILES_TO_DELETE = [
  "_category.json",
  "_edition.json",
  "_language.json",
  "_project.json",
  "_project-v2.json",
  "_publication-v2.json",
];

const DIRS_TO_DELETE = ["_publication"];

function deleteFolderRecursive(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file, index) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
}

function processDirectory(dirConfig) {
  const dirPath = path.join(BILARA_BASE, dirConfig.name);
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory not found: ${dirPath}`);
    return;
  }

  const subdirs = fs.readdirSync(dirPath);
  subdirs.forEach((subdir) => {
    const fullPath = path.join(dirPath, subdir);
    if (fs.lstatSync(fullPath).isDirectory()) {
      if (!dirConfig.keep.includes(subdir)) {
        console.log(`Deleting ${dirConfig.name}/${subdir}...`);
        deleteFolderRecursive(fullPath);
      } else {
        console.log(`Keeping ${dirConfig.name}/${subdir}`);
      }
    }
  });
}

function cleanup() {
  console.log("Starting cleanup of bilara-data-published...");

  // 1. Process main directories (keep specific langs)
  DIRS_TO_PROCESS.forEach(processDirectory);

  // 2. Delete specific unused directories
  DIRS_TO_DELETE.forEach((dirName) => {
    const fullPath = path.join(BILARA_BASE, dirName);
    if (fs.existsSync(fullPath)) {
      console.log(`Deleting directory ${dirName}...`);
      deleteFolderRecursive(fullPath);
    }
  });

  // 3. Delete specific unused files
  FILES_TO_DELETE.forEach((fileName) => {
    const fullPath = path.join(BILARA_BASE, fileName);
    if (fs.existsSync(fullPath)) {
      console.log(`Deleting file ${fileName}...`);
      fs.unlinkSync(fullPath);
    }
  });

  console.log("Cleanup complete.");
}

cleanup();
