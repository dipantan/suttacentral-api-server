/**
 * Cloudflare R2 (S3-compatible) storage layer.
 * Enabled when all four env vars are present:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 * All operations are no-ops when not configured.
 */
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
} = process.env;

const enabled = !!(
  R2_ACCOUNT_ID &&
  R2_ACCESS_KEY_ID &&
  R2_SECRET_ACCESS_KEY &&
  R2_BUCKET_NAME
);

let client = null;
if (enabled) {
  client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  console.log(`📦 R2 storage enabled (bucket: ${R2_BUCKET_NAME})`);
} else {
  console.log("📦 R2 storage not configured — using local disk only.");
}

async function uploadFile(key, filePath) {
  if (!enabled) return false;
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: "application/json",
    })
  );
  return true;
}

async function downloadFile(key, filePath) {
  if (!enabled) return false;
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
    );
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const chunks = [];
    for await (const chunk of res.Body) chunks.push(chunk);
    fs.writeFileSync(filePath, Buffer.concat(chunks));
    return true;
  } catch (err) {
    if (err.name === "NoSuchKey") return false;
    throw err;
  }
}

async function listKeys(prefix) {
  if (!enabled) return [];
  const keys = [];
  let continuationToken;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents || []) keys.push(obj.Key);
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

module.exports = { enabled, uploadFile, downloadFile, listKeys };
