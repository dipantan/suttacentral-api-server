const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pdfParse = require("pdf-parse");
const { getRootSegments, getReferenceSegments, getSuttaTemplate } = require("./template_service");
const { createReview } = require("./review_service");

// In-memory jobs tracking
const jobs = new Map();

/**
 * Extracts clean text from an uploaded file buffer (PDF or text).
 */
async function extractTextFromFile(buffer, mimetype, filename) {
  if (mimetype === "application/pdf" || (filename && filename.toLowerCase().endsWith(".pdf"))) {
    const data = await pdfParse(buffer);
    return data.text || "";
  }
  // Plain text / UTF-8
  return buffer.toString("utf8");
}

/**
 * Normalizes text for alignment processing.
 */
function cleanRawText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Calls Gemini API to align a batch of canonical segments with a chunk of raw text.
 */
async function alignBatchWithGemini({
  apiKey,
  model = "gemini-2.0-flash",
  langName = "Bengali",
  segmentsBatch,
  rawTextChunk,
}) {
  const prompt = `You are a Buddhist canonical scholar and localization expert.
Your mission is to align a vernacular translation in ${langName} with canonical Pāli Sutta segments.

Below is a list of segment IDs with their authentic Pāli text and English reference translations:
${JSON.stringify(segmentsBatch, null, 2)}

Below is the source text excerpt in ${langName}:
"""
${rawTextChunk}
"""

Instructions:
1. For every segment ID provided in the list, extract or translate the exact corresponding clause/sentence in ${langName}.
2. Maintain strict 1-to-1 alignment with the segment IDs. Do NOT omit any segment ID.
3. If two Pāli segments are combined in the source text, place the translated text in the first segment and an ellipsis ("…") or appropriate clause in the second.
4. Return ONLY a valid JSON object matching this schema:
{
  "segments": {
    "<segment_id>": "<${langName} translation>"
  }
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const rawOutput = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawOutput) {
    throw new Error("Empty response from Gemini API");
  }

  try {
    const parsed = JSON.parse(rawOutput);
    return parsed.segments || parsed;
  } catch (parseErr) {
    console.error("Failed to parse Gemini JSON output:", rawOutput);
    throw new Error("Invalid JSON returned by Gemini: " + parseErr.message);
  }
}

/**
 * Intelligent Fallback / Mock aligner for offline testing or when no API key is provided.
 */
function mockAlignBatch(segmentsBatch, rawTextChunk, langName) {
  const result = {};
  const paragraphs = rawTextChunk
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  segmentsBatch.forEach((item, index) => {
    // If raw text paragraph available, use it; otherwise provide clean placeholder
    if (paragraphs[index]) {
      result[item.id] = paragraphs[index];
    } else {
      result[item.id] = `[${langName}] ${item.ref}`;
    }
  });

  return result;
}

/**
 * Starts an asynchronous alignment job.
 */
function startAlignmentJob({
  uid,
  lang = "bn",
  langName = "Bengali",
  authorUid = "shilalankar",
  authorName = "Ven. Shilalankar Mahathero",
  rawText = "",
  sourceFilename = null,
  apiKey = process.env.GEMINI_API_KEY,
  model = "gemini-2.0-flash",
}) {
  const jobId = crypto.randomUUID();
  const rootSegments = getRootSegments(uid);
  const refSegments = getReferenceSegments(uid);
  const allKeys = Object.keys(rootSegments);

  if (allKeys.length === 0) {
    throw new Error(`No root Pāli segments found for sutta UID: ${uid}`);
  }

  const job = {
    id: jobId,
    uid,
    lang,
    langName,
    authorUid,
    authorName,
    status: "running",
    progress: 0,
    totalSegments: allKeys.length,
    processedSegments: 0,
    currentStep: "Starting alignment...",
    token: null,
    error: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };

  jobs.set(jobId, job);

  // Run asynchronously in background
  (async () => {
    try {
      const cleaned = cleanRawText(rawText);
      const BATCH_SIZE = 20;
      const alignedSegments = {};
      const segmentStatuses = {};

      const batches = [];
      for (let i = 0; i < allKeys.length; i += BATCH_SIZE) {
        const batchKeys = allKeys.slice(i, i + BATCH_SIZE);
        const batchItems = batchKeys.map((key) => ({
          id: key,
          root: rootSegments[key] || "",
          ref: refSegments[key] || "",
        }));
        batches.push(batchItems);
      }

      console.log(`Starting alignment job ${jobId} for ${uid} (${allKeys.length} segments in ${batches.length} batches)...`);

      for (let bIndex = 0; bIndex < batches.length; bIndex++) {
        const currentBatch = batches[bIndex];
        job.currentStep = `Aligning segments ${bIndex * BATCH_SIZE + 1} to ${Math.min((bIndex + 1) * BATCH_SIZE, allKeys.length)}...`;
        job.progress = Math.round((bIndex / batches.length) * 100);

        let batchResult = {};
        if (apiKey) {
          try {
            batchResult = await alignBatchWithGemini({
              apiKey,
              model,
              langName,
              segmentsBatch: currentBatch,
              rawTextChunk: cleaned,
            });
          } catch (geminiErr) {
            console.warn(`Gemini batch failed (${geminiErr.message}), falling back to heuristic alignment for batch ${bIndex}`);
            batchResult = mockAlignBatch(currentBatch, cleaned, langName);
          }
        } else {
          // Offline / Mock alignment
          batchResult = mockAlignBatch(currentBatch, cleaned, langName);
          // Brief pause for realistic UI progress
          await new Promise((res) => setTimeout(res, 200));
        }

        for (const item of currentBatch) {
          const val = batchResult[item.id] || "";
          alignedSegments[item.id] = val;
          segmentStatuses[item.id] = apiKey ? "ai" : "draft";
        }

        job.processedSegments = Object.keys(alignedSegments).length;
      }

      // Create staging review session
      const review = createReview({
        uid,
        lang,
        lang_name: langName,
        author_uid: authorUid,
        author_name: authorName,
        segments: alignedSegments,
        segment_statuses: segmentStatuses,
        source_filename: sourceFilename,
        raw_text: cleaned,
      });

      job.status = "completed";
      job.progress = 100;
      job.currentStep = "Alignment complete!";
      job.token = review.token;
      job.completedAt = new Date().toISOString();
      console.log(`✅ Alignment job ${jobId} completed. Review token: ${review.token}`);
    } catch (err) {
      console.error(`❌ Alignment job ${jobId} failed:`, err);
      job.status = "failed";
      job.error = err.message;
      job.completedAt = new Date().toISOString();
    }
  })();

  return job;
}

/**
 * Returns current status of a job.
 */
function getJobStatus(jobId) {
  return jobs.get(jobId) || null;
}

module.exports = {
  extractTextFromFile,
  startAlignmentJob,
  getJobStatus,
  cleanRawText,
};
