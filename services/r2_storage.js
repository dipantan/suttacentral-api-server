/**
 * Cloudflare R2 (S3-compatible) storage layer.
 * Accepts either naming convention:
 *   R2_ACCOUNT_ID / R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *   or S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_NAME, S3_REGION
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

const endpoint =
  process.env.R2_ENDPOINT ||
  process.env.S3_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);

const accessKeyId =
  process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY;
const secretAccessKey =
  process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY;
const bucket = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME;
const region = process.env.S3_REGION || "auto";

const enabled = !!(endpoint && accessKeyId && secretAccessKey && bucket);

let client = null;
if (enabled) {
  client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  console.log(`📦 R2 storage enabled (bucket: ${bucket})`);
} else {
  console.log("📦 R2 storage not configured — using local disk only.");
}

async function uploadFile(key, filePath) {
  if (!enabled) return false;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
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
      new GetObjectCommand({ Bucket: bucket, Key: key })
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
        Bucket: bucket,
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
