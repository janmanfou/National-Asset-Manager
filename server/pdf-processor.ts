import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import type { InsertVoter } from "@shared/schema";
import { hindiToEnglish } from "./transliterate";
import { GoogleGenAI } from "@google/genai";

const execAsync = promisify(exec);
const TEMP_DIR = "/tmp/ocr_processing";
const DPI = 150;
const GEMINI_CONCURRENCY = 5;
const PDF_CONCURRENCY = 3;

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const activeProcessing = new Set<string>();

export function isProcessing(fileId: string): boolean {
  return activeProcessing.has(fileId);
}

export function cancelProcessing(fileId: string): void {
  activeProcessing.delete(fileId);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cleanupDir(dir: string) {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

interface PdfHeaderInfo {
  acNoName: string;
  partNumber: string;
  sectionNumber: string;
  sectionName: string;
  psName: string;
  state: string;
  gram: string;
  thana: string;
  panchayat: string;
  block: string;
  tahsil: string;
  jilla: string;
}

interface GeminiVoter {
  serial: number;
  epic: string;
  name: string;
  relationType: string;
  relationName: string;
  house: string;
  age: number;
  gender: string;
}

interface GeminiPageResult {
  header?: {
    acNoName?: string;
    partNumber?: string;
    sectionNumber?: string;
    sectionName?: string;
    psName?: string;
    gram?: string;
    thana?: string;
    panchayat?: string;
    block?: string;
    tahsil?: string;
    jilla?: string;
  };
  voters: GeminiVoter[];
}

const EXTRACTION_PROMPT = `You are extracting voter data from an Indian electoral roll page in Hindi. Extract ALL voter entries visible on this page.

For EACH voter, extract:
- serial: Serial number (integer)
- epic: EPIC/voter ID number (like ABC1234567 or UP/xx/xxx/xxxxx)
- name: Voter's name in Hindi (exactly as written)
- relationType: "Father" or "Husband" or "Mother" or "Other" (based on पिता/पति/माता/अन्य)
- relationName: Father/Husband/Mother name in Hindi (exactly as written)
- house: House number (मकान संख्या)
- age: Age (integer, 18-120)
- gender: "M" for पुरुष, "F" for महिला, "O" for अन्य

Also extract header/location info if visible on this page (first page usually has it):
- acNoName: Assembly constituency number and name (विधानसभा निर्वाचन क्षेत्र)
- partNumber: Part number (भाग संख्या)  
- sectionNumber: Section number
- sectionName: Section name
- psName: Polling station name (मतदान स्थल)
- gram: Village/town (ग्राम/कस्बा)
- thana: Police station (थाना)
- panchayat: Panchayat name
- block: Block name (ब्लॉक)
- tahsil: Tahsil name (तहसील)
- jilla: District name (जिला)

Return ONLY valid JSON (no markdown, no backticks):
{"header":{"acNoName":"","partNumber":"","sectionNumber":"","sectionName":"","psName":"","gram":"","thana":"","panchayat":"","block":"","tahsil":"","jilla":""},"voters":[{"serial":1,"epic":"ABC1234567","name":"नाम","relationType":"Father","relationName":"पिता का नाम","house":"123","age":45,"gender":"M"}]}

If no voters are found (e.g. cover page, blank page), return: {"voters":[]}
If header info is not on this page, omit the "header" field.
Extract ALL voters you can see. Be thorough - do not skip any entries.`;

async function extractPageWithGemini(imagePath: string, retries = 3): Promise<GeminiPageResult> {
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: EXTRACTION_PROMPT },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64,
                },
              },
            ],
          },
        ],
        config: {
          maxOutputTokens: 8192,
          temperature: 0.1,
        },
      });

      const text = response.text || "";
      const jsonStr = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      try {
        const parsed = JSON.parse(jsonStr);
        return {
          header: parsed.header || undefined,
          voters: Array.isArray(parsed.voters) ? parsed.voters : [],
        };
      } catch {
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            header: parsed.header || undefined,
            voters: Array.isArray(parsed.voters) ? parsed.voters : [],
          };
        }
        if (attempt < retries - 1) continue;
        console.error(`[OCR] JSON parse failed for ${path.basename(imagePath)}: ${text.substring(0, 200)}`);
        return { voters: [] };
      }
    } catch (e: any) {
      const isRateLimit = e.message?.includes("429") || e.message?.includes("rate") || e.message?.includes("quota");
      if (isRateLimit && attempt < retries - 1) {
        const delay = Math.pow(2, attempt + 1) * 1000 + Math.random() * 1000;
        console.log(`[OCR] Rate limited, waiting ${(delay / 1000).toFixed(1)}s before retry...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      console.error(`[OCR] Gemini error for ${path.basename(imagePath)}: ${e.message?.substring(0, 200)}`);
      return { voters: [] };
    }
  }
  return { voters: [] };
}

function buildVoterRecord(v: GeminiVoter, fileId: string, boothNum: string, header: PdfHeaderInfo): InsertVoter {
  const status = (v.epic && v.name && v.age > 0)
    ? "verified" as const
    : (v.epic || v.name)
      ? "flagged" as const
      : "incomplete" as const;

  const genderLabel = v.gender === "M" ? "Male" : v.gender === "F" ? "Female" : v.gender || "";

  return {
    fileId,
    serialNumber: v.serial || 0,
    epicNumber: v.epic || "",
    voterName: v.name || "Unknown",
    voterNameEn: hindiToEnglish(v.name || ""),
    relationType: v.relationType || "",
    relationName: v.relationName || "",
    relationNameEn: hindiToEnglish(v.relationName || ""),
    gender: genderLabel,
    age: (v.age >= 18 && v.age <= 120) ? v.age : null,
    houseNo: v.house || "",
    address: v.house ? `House No. ${v.house}` : "",
    boothNumber: boothNum,
    partNumber: boothNum,
    acNoName: header.acNoName,
    constituency: header.acNoName,
    sectionNumber: header.sectionNumber,
    sectionName: header.sectionName,
    sectionNameEn: null,
    psName: header.psName,
    state: header.state,
    gram: hindiToEnglish(header.gram),
    thana: hindiToEnglish(header.thana),
    panchayat: hindiToEnglish(header.panchayat),
    block: hindiToEnglish(header.block),
    tahsil: hindiToEnglish(header.tahsil),
    jilla: hindiToEnglish(header.jilla),
    status,
  };
}

async function insertVoterBatch(voters: InsertVoter[]): Promise<void> {
  const CHUNK = 200;
  for (let c = 0; c < voters.length; c += CHUNK) {
    const chunk = voters.slice(c, c + CHUNK);
    try {
      await storage.createVoterRecordsBatch(chunk);
    } catch (e: any) {
      console.error(`[OCR] Batch insert error: ${e.message?.substring(0, 100)}`);
    }
  }
}

async function processOnePdfWithGemini(
  pdfPath: string,
  fileId: string,
  pdfIndex: number,
  sharedHeader: PdfHeaderInfo,
): Promise<{ voters: InsertVoter[]; pagesProcessed: number; headerInfo: PdfHeaderInfo | null }> {
  const pdfName = path.basename(pdfPath);
  const imgDir = path.join(TEMP_DIR, `pdf_${fileId}_${pdfIndex}`);
  ensureDir(imgDir);

  const filenameInfo = pdfName.match(/HIN-(\d+)/i);
  const boothFromFilename = filenameInfo ? filenameInfo[1] : "";

  try {
    await execAsync(
      `pdftoppm -r ${DPI} -gray -png "${pdfPath}" "${path.join(imgDir, 'p')}"`,
      { timeout: 300000, maxBuffer: 50 * 1024 * 1024 }
    );
  } catch (e: any) {
    console.error(`[OCR] pdftoppm failed for ${pdfName}: ${e.message?.substring(0, 100)}`);
    cleanupDir(imgDir);
    return { voters: [], pagesProcessed: 0, headerInfo: null };
  }

  const images = fs.readdirSync(imgDir)
    .filter(f => f.endsWith(".png"))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.match(/\d+/)?.[0] || "0");
      return numA - numB;
    })
    .map(f => path.join(imgDir, f));

  if (images.length === 0) {
    cleanupDir(imgDir);
    return { voters: [], pagesProcessed: 0, headerInfo: null };
  }

  const allVoters: InsertVoter[] = [];
  let extractedHeader: PdfHeaderInfo | null = null;

  const processPage = async (imgPath: string): Promise<GeminiPageResult> => {
    const result = await extractPageWithGemini(imgPath);
    try { fs.unlinkSync(imgPath); } catch {}
    return result;
  };

  const pageResults = await processWithConcurrency(images, GEMINI_CONCURRENCY, processPage);

  for (const result of pageResults) {
    if (result.header && !extractedHeader) {
      const h = result.header;
      extractedHeader = {
        acNoName: h.acNoName || "",
        partNumber: h.partNumber || "",
        sectionNumber: h.sectionNumber || "",
        sectionName: h.sectionName || "",
        psName: h.psName || "",
        state: "Uttar Pradesh",
        gram: h.gram || "",
        thana: h.thana || "",
        panchayat: h.panchayat || "",
        block: h.block || "",
        tahsil: h.tahsil || "",
        jilla: h.jilla || "",
      };
    }

    if (result.voters.length > 0) {
      const effectiveHeader = extractedHeader || sharedHeader;
      const boothNum = boothFromFilename || effectiveHeader.partNumber;
      for (const v of result.voters) {
        allVoters.push(buildVoterRecord(v, fileId, boothNum, effectiveHeader));
      }
    }
  }

  cleanupDir(imgDir);
  return { voters: allVoters, pagesProcessed: images.length, headerInfo: extractedHeader };
}

async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await processor(items[idx]);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

export async function processZipFile(zipPath: string, fileId: string): Promise<void> {
  if (activeProcessing.has(fileId)) {
    console.log(`[OCR] File ${fileId} is already being processed, skipping`);
    return;
  }
  activeProcessing.add(fileId);

  const extractDir = path.join(TEMP_DIR, `zip_${fileId}`);
  ensureDir(extractDir);

  try {
    await storage.updateFile(fileId, { status: "processing", progress: 0 });
    await storage.createAuditLog({
      action: "Processing Started",
      details: `Started processing file ${fileId} with Gemini AI OCR`,
      status: "Success",
    });

    console.log(`[OCR] Extracting ZIP: ${path.basename(zipPath)}`);
    try {
      await execAsync(
        `unzip -o "${zipPath}" -d "${extractDir}" -x "__MACOSX/*" "*.DS_Store"`,
        { timeout: 600000, maxBuffer: 50 * 1024 * 1024 }
      );
      console.log(`[OCR] ZIP extraction complete`);
    } catch (e: any) {
      console.error(`[OCR] ZIP extraction failed: ${e.message?.substring(0, 200)}`);
      await storage.updateFile(fileId, { status: "failed", errorMessage: `ZIP extraction failed: ${e.message?.substring(0, 200)}` });
      cleanupDir(extractDir);
      return;
    }

    const allPdfs: string[] = [];
    const findPdfs = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith("__MACOSX") && !entry.name.startsWith(".")) {
          findPdfs(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf") && !entry.name.startsWith("._")) {
          allPdfs.push(fullPath);
        }
      }
    };
    findPdfs(extractDir);

    const totalFound = allPdfs.length;
    console.log(`[OCR] Found ${totalFound} PDF files in ZIP`);

    const MIN_PDF_SIZE = 500;
    const validPdfs: string[] = [];
    const skippedPdfs: string[] = [];

    for (const pdf of allPdfs) {
      const stats = fs.statSync(pdf);
      if (stats.size >= MIN_PDF_SIZE) {
        validPdfs.push(pdf);
      } else {
        skippedPdfs.push(path.basename(pdf));
      }
    }

    validPdfs.sort((a, b) => {
      const numA = parseInt(path.basename(a).match(/HIN-(\d+)/)?.[1] || path.basename(a).match(/(\d+)/)?.[1] || "0");
      const numB = parseInt(path.basename(b).match(/HIN-(\d+)/)?.[1] || path.basename(b).match(/(\d+)/)?.[1] || "0");
      return numA - numB;
    });

    console.log(`[OCR] Valid PDFs: ${validPdfs.length}, Skipped (empty/tiny): ${skippedPdfs.length}`);

    if (validPdfs.length === 0) {
      await storage.updateFile(fileId, { status: "failed", errorMessage: "No valid PDF files found in ZIP archive" });
      cleanupDir(extractDir);
      return;
    }

    const fileRecord = await storage.getFile(fileId);
    const alreadyProcessed = fileRecord?.pagesProcessed ?? 0;
    const alreadyExtracted = fileRecord?.extractedCount ?? 0;
    const isResume = alreadyProcessed > 0 && alreadyProcessed < validPdfs.length;

    if (isResume) {
      console.log(`[OCR] RESUMING from PDF ${alreadyProcessed + 1}/${validPdfs.length} (${alreadyExtracted} voters already extracted)`);
      validPdfs.splice(0, alreadyProcessed);
    } else {
      await storage.deleteVoterRecordsByFileId(fileId);
      console.log(`[OCR] Cleared old records, starting fresh`);
    }

    await storage.updateFile(fileId, {
      totalPages: totalFound,
      skippedPages: skippedPdfs.length,
      processingStartedAt: isResume ? (fileRecord?.processingStartedAt ?? new Date()) : new Date(),
    });

    const defaultHeader: PdfHeaderInfo = {
      acNoName: "",
      partNumber: "",
      sectionNumber: "",
      sectionName: "",
      psName: "",
      state: "Uttar Pradesh",
      gram: "",
      thana: "",
      panchayat: "",
      block: "",
      tahsil: "",
      jilla: "",
    };

    let totalVoters = isResume ? alreadyExtracted : 0;
    let processedCount = isResume ? alreadyProcessed : 0;
    let failedPdfs: string[] = [];
    const startTime = Date.now();
    const originalTotal = totalFound - skippedPdfs.length;

    console.log(`[OCR] Starting Gemini AI processing: ${validPdfs.length} PDFs, PDF_CONCURRENCY=${PDF_CONCURRENCY}, GEMINI_CONCURRENCY=${GEMINI_CONCURRENCY}`);

    await processWithConcurrency(validPdfs, PDF_CONCURRENCY, async (pdfPath) => {
      if (!activeProcessing.has(fileId)) return;
      const pdfName = path.basename(pdfPath);
      try {
        const result = await processOnePdfWithGemini(pdfPath, fileId, processedCount, defaultHeader);

        if (result.headerInfo && !defaultHeader.acNoName && result.headerInfo.acNoName) {
          defaultHeader.acNoName = result.headerInfo.acNoName;
        }
        if (result.headerInfo) {
          if (!defaultHeader.gram && result.headerInfo.gram) defaultHeader.gram = result.headerInfo.gram;
          if (!defaultHeader.jilla && result.headerInfo.jilla) defaultHeader.jilla = result.headerInfo.jilla;
        }

        if (result.voters.length > 0) {
          await insertVoterBatch(result.voters);
          totalVoters += result.voters.length;
        }

        processedCount++;
        const progress = Math.floor((processedCount / originalTotal) * 100);
        const sessionProcessed = processedCount - (isResume ? alreadyProcessed : 0);
        const elapsed = (Date.now() - startTime) / 1000;
        const sessionRate = sessionProcessed > 0 ? sessionProcessed / (elapsed / 3600) : 0;
        const avgMs = sessionProcessed > 0 ? Math.floor(elapsed * 1000 / sessionProcessed) : 0;

        if (processedCount % 10 === 0 || processedCount <= 5 || processedCount === originalTotal) {
          const remaining = originalTotal - processedCount;
          const etaMin = avgMs > 0 ? ((remaining * avgMs / PDF_CONCURRENCY) / 1000 / 60).toFixed(1) : '?';
          console.log(`[OCR] Progress: ${processedCount}/${originalTotal} PDFs (${progress}%) | ${totalVoters} voters | ${sessionRate.toFixed(0)} PDFs/hr | ETA: ${etaMin}m`);
        }

        await storage.updateFile(fileId, {
          pagesProcessed: processedCount,
          progress: Math.min(progress, 99),
          extractedCount: totalVoters,
          avgPageTimeMs: avgMs > 0 ? avgMs : (fileRecord?.avgPageTimeMs ?? 0),
        });
      } catch (e: any) {
        failedPdfs.push(pdfName);
        processedCount++;
        console.error(`[OCR] Failed PDF ${pdfName}: ${e.message?.substring(0, 100)}`);
      }

      try { fs.unlinkSync(pdfPath); } catch {}
    });

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const finalRate = (originalTotal / ((Date.now() - startTime) / 1000 / 3600)).toFixed(0);

    console.log(`[OCR] COMPLETE: ${originalTotal} PDFs in ${totalTime} min | ${totalVoters} voters | ${finalRate} PDFs/hr`);
    if (failedPdfs.length > 0) {
      console.log(`[OCR] Failed PDFs (${failedPdfs.length}): ${failedPdfs.slice(0, 20).join(", ")}`);
    }

    const statusMsg = failedPdfs.length > 0
      ? `Processed ${validPdfs.length - failedPdfs.length}/${validPdfs.length} PDFs. ${failedPdfs.length} failed. ${skippedPdfs.length} empty files skipped.`
      : undefined;

    await storage.updateFile(fileId, {
      status: "completed",
      progress: 100,
      pagesProcessed: originalTotal,
      extractedCount: totalVoters,
      totalPages: totalFound,
      skippedPages: skippedPdfs.length,
      errorMessage: statusMsg || null,
    });

    await storage.createAuditLog({
      action: "Processing Complete",
      details: `Extracted ${totalVoters} voters from ${validPdfs.length} PDFs (${skippedPdfs.length} skipped, ${failedPdfs.length} failed) in ${totalTime} min`,
      status: "Success",
    });

  } catch (e: any) {
    console.error(`[OCR] Processing error for ${fileId}: ${e.message}`);
    await storage.updateFile(fileId, {
      status: "failed",
      errorMessage: e.message,
    });
  } finally {
    activeProcessing.delete(fileId);
  }
}

export async function processSinglePdfFile(pdfPath: string, fileId: string): Promise<void> {
  if (activeProcessing.has(fileId)) {
    console.log(`[OCR] File ${fileId} is already being processed, skipping`);
    return;
  }
  activeProcessing.add(fileId);

  try {
    const startTime = Date.now();
    await storage.updateFile(fileId, {
      status: "processing",
      progress: 0,
      processingStartedAt: new Date(),
    });

    const header: PdfHeaderInfo = {
      acNoName: "",
      partNumber: "",
      sectionNumber: "",
      sectionName: "",
      psName: "",
      state: "Uttar Pradesh",
      gram: "",
      thana: "",
      panchayat: "",
      block: "",
      tahsil: "",
      jilla: "",
    };

    console.log(`[OCR] Starting single PDF processing with Gemini: ${path.basename(pdfPath)}`);
    const result = await processOnePdfWithGemini(pdfPath, fileId, 0, header);

    if (result.voters.length > 0) {
      await storage.deleteVoterRecordsByFileId(fileId);
      await insertVoterBatch(result.voters);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[OCR] Single PDF complete: ${result.voters.length} voters from ${result.pagesProcessed} pages in ${totalTime}s`);
    await storage.updateFile(fileId, {
      status: "completed",
      progress: 100,
      pagesProcessed: result.pagesProcessed,
      extractedCount: result.voters.length,
      totalPages: result.pagesProcessed,
    });

  } catch (e: any) {
    console.error(`[OCR] PDF processing error: ${e.message}`);
    await storage.updateFile(fileId, { status: "failed", errorMessage: e.message });
  } finally {
    activeProcessing.delete(fileId);
  }
}
