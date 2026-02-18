import { exec, execSync } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import type { InsertVoter } from "@shared/schema";
import { hindiToEnglish } from "./transliterate";

const execAsync = promisify(exec);
const TEMP_DIR = "/tmp/ocr_processing";
const CONCURRENCY = 1;
const DPI = 100;
const PAGE_PARALLELISM = 2;

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
  totalVoters: string;
  gram: string;
  thana: string;
  panchayat: string;
  block: string;
  tahsil: string;
  jilla: string;
}

interface ParsedVoter {
  serialNumber: number;
  epicNumber: string;
  voterName: string;
  relationType: string;
  relationName: string;
  houseNo: string;
  age: number;
  gender: string;
}

function parseLocationBlock(ocrText: string, info: PdfHeaderInfo): void {
  const colonVal = /[:：<;\.\$4]\s*/;

  const tryInline = (label: RegExp) => {
    const re = new RegExp(label.source + `\\s*${colonVal.source}([^\\n]+)`, label.flags);
    const m = ocrText.match(re);
    return m ? m[1].trim() : "";
  };

  info.gram = tryInline(/(?:मुख्य\s*)?(?:कस्बा\s*)?(?:अथवा\s*)?ग्राम/) || tryInline(/[ईE][\.\s]*[T7][\.\s]*अथवा\s*ग्राम/);
  info.thana = tryInline(/थाना/);
  info.panchayat = tryInline(/पंचायत/);
  info.block = tryInline(/ब्लॉक/);
  info.tahsil = tryInline(/तहसील/);
  info.jilla = tryInline(/जिला/);

  if (info.gram || info.thana || info.panchayat || info.block || info.tahsil || info.jilla) {
    return;
  }

  const lines = ocrText.split("\n");

  let blockStartLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("ग्राम") || lines[i].match(/[ईE][\.\s]*[T7][\.\s]*अथवा/)) {
      blockStartLine = i;
      break;
    }
  }
  if (blockStartLine < 0) return;

  const afterBlock = lines.slice(blockStartLine).join("\n");

  const valPattern = /[:：<;\$4]\s*([^\n]+)/g;
  const allValues: string[] = [];
  let vm;
  while ((vm = valPattern.exec(afterBlock)) !== null) {
    const val = vm[1].trim();
    if (val.length > 0 && !val.includes("मतदान") && !val.includes("निर्वाचक") && !val.includes("सामान्य")) {
      allValues.push(val);
    }
    if (allValues.length >= 9) break;
  }

  if (allValues.length >= 1) info.gram = allValues[0] || "";
  if (allValues.length >= 3) info.thana = allValues[2] || "";
  if (allValues.length >= 4) info.panchayat = allValues[3] || "";
  if (allValues.length >= 5) info.block = allValues[4] || "";
  if (allValues.length >= 6) info.tahsil = allValues[5] || "";
  if (allValues.length >= 7) info.jilla = allValues[6] || "";
}

function parseHeaderPage(ocrText: string): PdfHeaderInfo {
  const info: PdfHeaderInfo = {
    acNoName: "",
    partNumber: "",
    sectionNumber: "",
    sectionName: "",
    psName: "",
    state: "Uttar Pradesh",
    totalVoters: "",
    gram: "",
    thana: "",
    panchayat: "",
    block: "",
    tahsil: "",
    jilla: "",
  };

  const acMatch = ocrText.match(/विधानसभा\s*निर्वाचन\s*क्षेत्र\s*(?:की\s*)?(?:संख्या\s*(?:व|और)\s*नाम\s*(?:और\s*आरक्षण\s*स्थिति\s*)?)?[:：]?\s*(\d+)\s*[-–]\s*([^\n(]+)/);
  if (acMatch) {
    info.acNoName = `${acMatch[1]}-${acMatch[2].trim()}`;
  }

  const partMatch = ocrText.match(/भाग\s*संख्या\s*[:：]\s*[:：]?\s*(\d+)/);
  if (partMatch) {
    info.partNumber = partMatch[1];
  }

  const sectionMatch = ocrText.match(/अनुभाग(?:ों)?\s*(?:की\s*)?(?:संख्या\s*(?:और|व)\s*नाम\s*)?[:：]\s*\n?\s*(\d+)[-–]([^\n]+)/);
  if (sectionMatch) {
    info.sectionNumber = sectionMatch[1].trim();
    info.sectionName = sectionMatch[2].trim();
  }

  const psMatch = ocrText.match(/मतदान\s*स्थल\s*(?:की\s*)?(?:संख्या\s*(?:और|व)\s*नाम\s*)?[:：]\s*(?:सामान्य\s*)?[-–]?\s*([^\n]+)/);
  if (psMatch) {
    const ps = psMatch[1].replace(/इस\s*भाग.*$/, "").trim();
    if (ps.length > 3) info.psName = ps;
  }
  if (!info.psName) {
    const psMatch2 = ocrText.match(/मतदान\s*स्थल\s*का\s*पता\s*[:：]?\s*\n?\s*([^\n]+)/);
    if (psMatch2) info.psName = psMatch2[1].trim();
  }

  parseLocationBlock(ocrText, info);

  return info;
}

function parseVoterBlocks(ocrText: string): ParsedVoter[] {
  const voters: ParsedVoter[] = [];

  const blocks = ocrText.split(/(?=\d+\s*[\]|\|]?\s*[A-Z]{2,3}\d{4,10}|\d+\s*[\]|\|]?\s*UP\/)/);

  for (const block of blocks) {
    if (block.trim().length < 20) continue;

    const epicMatch = block.match(/(\d+)\s*[\]|\|]?\s*([A-Z]{2,3}\d{4,10}|UP\/\d+\/\d+\/\d+)/);
    if (!epicMatch) continue;

    const serialNumber = parseInt(epicMatch[1]);
    const epicNumber = epicMatch[2];

    if (isNaN(serialNumber) || serialNumber < 1 || serialNumber > 3000) continue;

    let voterName = "";
    const nameMatch = block.match(/(?<![पिता|पति|माता|अन्य]\s*(?:का\s*)?)नाम\s*[:：]\s*([^\n]+)/);
    if (nameMatch) {
      voterName = nameMatch[1]
        .replace(/\s*(नाम|पिता|पति|माता|अन्य|मकान|आयु|लिंग|फोटो|उपलब्ध|[:：]).*$/, "")
        .trim();
    }
    if (!voterName) {
      const altName = block.match(/\b(?:नाम)\s*[:：]\s*([^\s]+(?:\s+[^\s]+)?)/);
      if (altName) {
        voterName = altName[1].replace(/\s*(नाम|पिता|पति|माता|अन्य|मकान|आयु|लिंग|फोटो|उपलब्ध).*$/, "").trim();
      }
    }

    let relationType = "";
    let relationName = "";
    const relMatch = block.match(/(पिता|पति|माता|अन्य)\s*(?:का\s*)?नाम\s*[:：]\s*([^\n]+)/);
    if (relMatch) {
      relationType = relMatch[1] === "पिता" ? "Father"
        : relMatch[1] === "पति" ? "Husband"
        : relMatch[1] === "माता" ? "Mother"
        : "Other";
      relationName = relMatch[2]
        .replace(/\s*(मकान|फोटो|आयु|लिंग|नाम|उपलब्ध|पिता|पति|माता|[:：]).*$/, "")
        .trim();
    }

    let houseNo = "";
    const houseMatch = block.match(/मकान\s*संख्या\s*[:；;]\s*(\S+)/);
    if (houseMatch) {
      houseNo = houseMatch[1].replace(/[|[\]{}()]/g, "").trim();
    }

    let age = 0;
    let gender = "";
    const ageMatch = block.match(/आयु\s*[:：]\s*(\d+)/);
    if (ageMatch) {
      const a = parseInt(ageMatch[1]);
      if (a >= 18 && a <= 120) age = a;
    }
    const genderMatch = block.match(/लिंग\s*[:：]\s*(पुरुष|महिला|अन्य)/);
    if (genderMatch) {
      gender = genderMatch[1] === "पुरुष" ? "M" : genderMatch[1] === "महिला" ? "F" : "O";
    }

    if (!epicNumber && !voterName && age === 0) continue;

    voters.push({
      serialNumber,
      epicNumber,
      voterName: voterName || "Unknown",
      relationType,
      relationName,
      houseNo,
      age,
      gender,
    });
  }

  if (voters.length > 0) return voters;

  return parseVotersFallback(ocrText);
}

function parseVotersFallback(ocrText: string): ParsedVoter[] {
  const voters: ParsedVoter[] = [];

  const epicPattern = /([A-Z]{2,3}\d{5,10}|UP\/\d+\/\d+\/\d+)/g;
  const epics: string[] = [];
  let m;
  while ((m = epicPattern.exec(ocrText)) !== null) {
    if (m[1].length >= 6) epics.push(m[1]);
  }

  const ageGenders: { age: number; gender: string }[] = [];
  const agPattern = /आयु\s*[:：]\s*(\d+)\s*(?:.*?)लिंग\s*[:：]\s*(पुरुष|महिला|अन्य)/g;
  while ((m = agPattern.exec(ocrText)) !== null) {
    const age = parseInt(m[1]);
    if (age >= 18 && age <= 120) {
      ageGenders.push({
        age,
        gender: m[2] === "पुरुष" ? "M" : m[2] === "महिला" ? "F" : "O",
      });
    }
  }

  const allNames: string[] = [];
  const voterNamePattern = /(?<!(पिता|पति|माता|अन्य)\s*(?:का\s*)?)नाम\s*[:：]\s*([^\n]+)/g;
  while ((m = voterNamePattern.exec(ocrText)) !== null) {
    if (m.index > 0) {
      const before = ocrText.substring(Math.max(0, m.index - 20), m.index);
      if (before.match(/(पिता|पति|माता|अन्य)\s*(?:का\s*)?$/)) continue;
    }
    if (ocrText.substring(Math.max(0, m.index - 5), m.index).match(/अनुभाग|निर्वाचन|नामावली/)) continue;
    const cleaned = m[2]
      .replace(/\s*(नाम|पिता|पति|माता|अन्य|मकान|आयु|लिंग|फोटो|उपलब्ध|[:：]).*$/, "")
      .trim();
    if (cleaned.length > 0 && cleaned.length < 40) {
      allNames.push(cleaned);
    }
  }

  const relations: { name: string; type: string }[] = [];
  const relPattern = /(पिता|पति|माता|अन्य)\s*(?:का\s*)?नाम\s*[:：]\s*/g;
  const relPositions: { pos: number; type: string; endOfMatch: number }[] = [];
  while ((m = relPattern.exec(ocrText)) !== null) {
    relPositions.push({ pos: m.index, type: m[1], endOfMatch: m.index + m[0].length });
  }

  for (let i = 0; i < relPositions.length; i++) {
    const start = relPositions[i].endOfMatch;
    const endBound = i + 1 < relPositions.length ? relPositions[i + 1].pos : ocrText.length;
    const chunk = ocrText.substring(start, endBound);
    const firstLine = chunk.split(/\n/)[0].trim();
    const cleaned = firstLine
      .replace(/\s*(मकान|फोटो|आयु|लिंग|नाम|पिता|पति|माता|अन्य|उपलब्ध|[:：]).*$/, "")
      .trim();
    if (cleaned.length > 0 && cleaned.length < 40) {
      const type = relPositions[i].type === "पिता" ? "Father"
        : relPositions[i].type === "पति" ? "Husband"
        : relPositions[i].type === "माता" ? "Mother" : "Other";
      relations.push({ name: cleaned, type });
    }
  }

  const houseNumbers: string[] = [];
  const housePattern = /मकान\s*संख्या\s*[:；;]\s*(\S+)/g;
  while ((m = housePattern.exec(ocrText)) !== null) {
    houseNumbers.push(m[1].replace(/[|[\]{}()]/g, "").trim());
  }

  const count = ageGenders.length;
  if (count === 0) return [];

  for (let i = 0; i < count; i++) {
    voters.push({
      serialNumber: i + 1,
      epicNumber: i < epics.length ? epics[i] : "",
      voterName: i < allNames.length ? allNames[i] : "Unknown",
      relationType: i < relations.length ? relations[i].type : "",
      relationName: i < relations.length ? relations[i].name : "",
      houseNo: i < houseNumbers.length ? houseNumbers[i] : "",
      age: ageGenders[i].age,
      gender: ageGenders[i].gender,
    });
  }

  return voters;
}

async function ocrPageAsync(imagePath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `tesseract "${imagePath}" stdout -l hin --oem 1 --psm 4 2>/dev/null`,
      { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout;
  } catch (e: any) {
    console.error(`[OCR] OCR error for ${path.basename(imagePath)}: ${e.message?.substring(0, 300)}`);
    return "";
  }
}

function buildVoterRecord(v: ParsedVoter, fileId: string, boothNum: string, effectiveHeader: PdfHeaderInfo): InsertVoter {
  const status = (v.epicNumber && v.voterName && v.voterName !== "Unknown" && v.age > 0)
    ? "verified" as const
    : (v.epicNumber || (v.voterName && v.voterName !== "Unknown"))
      ? "flagged" as const
      : "incomplete" as const;

  const genderLabel = v.gender === "M" ? "Male" : v.gender === "F" ? "Female" : v.gender;

  return {
    fileId,
    serialNumber: v.serialNumber,
    epicNumber: v.epicNumber,
    voterName: v.voterName,
    voterNameEn: hindiToEnglish(v.voterName),
    relationType: v.relationType,
    relationName: v.relationName,
    relationNameEn: hindiToEnglish(v.relationName),
    gender: genderLabel,
    age: v.age || null,
    houseNo: v.houseNo,
    address: v.houseNo ? `House No. ${v.houseNo}` : "",
    boothNumber: boothNum,
    partNumber: boothNum,
    acNoName: effectiveHeader.acNoName,
    constituency: effectiveHeader.acNoName,
    sectionNumber: effectiveHeader.sectionNumber,
    sectionName: effectiveHeader.sectionName,
    sectionNameEn: null,
    psName: effectiveHeader.psName,
    state: effectiveHeader.state,
    gram: hindiToEnglish(effectiveHeader.gram),
    thana: hindiToEnglish(effectiveHeader.thana),
    panchayat: hindiToEnglish(effectiveHeader.panchayat),
    block: hindiToEnglish(effectiveHeader.block),
    tahsil: hindiToEnglish(effectiveHeader.tahsil),
    jilla: hindiToEnglish(effectiveHeader.jilla),
    status,
  };
}

async function processOnePdf(
  pdfPath: string,
  fileId: string,
  pdfIndex: number,
  globalSerialStart: number,
  headerInfo: PdfHeaderInfo,
  onProgress?: (page: number, totalPages: number, votersSoFar: number) => void
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

  console.log(`[OCR] Processing ${pdfName}: ${images.length} pages at ${DPI} DPI (${PAGE_PARALLELISM} parallel)`);

  if (images.length > 0) {
    const firstOcr = await ocrPageAsync(images[0]);
    try { fs.unlinkSync(images[0]); } catch {}
    if (firstOcr.trim()) {
      const hdr = parseHeaderPage(firstOcr);
      if (hdr.acNoName || hdr.partNumber || hdr.sectionName) {
        extractedHeader = hdr;
        if (hdr.gram || hdr.thana || hdr.jilla) {
          console.log(`[OCR] Location: gram=${hdr.gram}, thana=${hdr.thana}, panchayat=${hdr.panchayat}, block=${hdr.block}, tahsil=${hdr.tahsil}, jilla=${hdr.jilla}`);
        }
      }
      const hasVoterData = firstOcr.includes("नाम") && firstOcr.includes("आयु");
      if (hasVoterData) {
        const parsed = parseVoterBlocks(firstOcr);
        const effectiveHeader = extractedHeader || headerInfo;
        const boothNum = boothFromFilename || effectiveHeader.partNumber;
        for (const v of parsed) {
          allVoters.push(buildVoterRecord(v, fileId, boothNum, effectiveHeader));
        }
      }
    }
    if (onProgress) onProgress(1, images.length, allVoters.length);
  }

  const remaining = images.slice(1);
  for (let batchStart = 0; batchStart < remaining.length; batchStart += PAGE_PARALLELISM) {
    const batch = remaining.slice(batchStart, batchStart + PAGE_PARALLELISM);
    const results = await Promise.all(batch.map(async (img, bIdx) => {
      const ocrText = await ocrPageAsync(img);
      try { fs.unlinkSync(img); } catch {}
      return { ocrText, pageIdx: batchStart + bIdx + 1 };
    }));

    for (const { ocrText, pageIdx } of results) {
      if (!ocrText.trim()) continue;

      if (pageIdx <= 2 && !extractedHeader) {
        const hdr = parseHeaderPage(ocrText);
        if (hdr.acNoName || hdr.partNumber || hdr.sectionName) {
          extractedHeader = hdr;
        }
      }

      const hasVoterData = ocrText.includes("नाम") && ocrText.includes("आयु");
      if (!hasVoterData) continue;

      const parsed = parseVoterBlocks(ocrText);
      if (parsed.length === 0) continue;

      const effectiveHeader = extractedHeader || headerInfo;
      const boothNum = boothFromFilename || effectiveHeader.partNumber;
      for (const v of parsed) {
        allVoters.push(buildVoterRecord(v, fileId, boothNum, effectiveHeader));
      }
    }

    const totalDone = Math.min(batchStart + PAGE_PARALLELISM + 1, images.length);
    if (onProgress) onProgress(totalDone, images.length, allVoters.length);
  }

  cleanupDir(imgDir);
  return { voters: allVoters, pagesProcessed: images.length, headerInfo: extractedHeader };
}

async function processInParallel<T>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const total = items.length;

  async function worker() {
    while (nextIndex < total) {
      const idx = nextIndex++;
      await processor(items[idx], idx);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, total); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
}

async function insertVoterBatch(voters: any[]): Promise<void> {
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
      details: `Started processing file ${fileId}`,
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
    if (skippedPdfs.length > 0) {
      console.log(`[OCR] Skipped files: ${skippedPdfs.slice(0, 10).join(", ")}${skippedPdfs.length > 10 ? ` ... and ${skippedPdfs.length - 10} more` : ""}`);
    }

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
      console.log(`[OCR] Cleared old records, starting fresh insert`);
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
      totalVoters: "",
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

    console.log(`[OCR] Starting parallel processing: ${validPdfs.length} PDFs with CONCURRENCY=${CONCURRENCY}, PAGE_PARALLELISM=${PAGE_PARALLELISM}, DPI=${DPI}`);

    await processInParallel(validPdfs, CONCURRENCY, async (pdfPath, idx) => {
      if (!activeProcessing.has(fileId)) return;
      const pdfName = path.basename(pdfPath);
      try {
        const result = await processOnePdf(pdfPath, fileId, idx, 0, defaultHeader);

        if (result.headerInfo && !defaultHeader.acNoName && result.headerInfo.acNoName) {
          defaultHeader.acNoName = result.headerInfo.acNoName;
        }

        if (result.voters.length > 0) {
          await insertVoterBatch(result.voters);
          totalVoters += result.voters.length;
        }

        processedCount++;
        const originalTotal = totalFound - skippedPdfs.length;
        const progress = Math.floor((processedCount / originalTotal) * 100);
        const sessionProcessed = processedCount - (isResume ? alreadyProcessed : 0);
        const elapsed = (Date.now() - startTime) / 1000;
        const sessionRate = sessionProcessed > 0 ? sessionProcessed / (elapsed / 3600) : 0;
        const avgMs = sessionProcessed > 0 ? Math.floor(elapsed * 1000 / sessionProcessed) : 0;

        if (processedCount % 5 === 0 || processedCount <= 5 || (isResume && sessionProcessed <= 3)) {
          const remaining = originalTotal - processedCount;
          const etaMin = avgMs > 0 ? ((remaining * avgMs / CONCURRENCY) / 1000 / 60).toFixed(1) : '?';
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
    const originalTotal = totalFound - skippedPdfs.length;
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
    cleanupDir(extractDir);
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
      totalVoters: "",
      gram: "",
      thana: "",
      panchayat: "",
      block: "",
      tahsil: "",
      jilla: "",
    };

    console.log(`[OCR] Starting single PDF processing: ${path.basename(pdfPath)}`);
    const result = await processOnePdf(pdfPath, fileId, 0, 1, header, async (page, totalPages, votersSoFar) => {
      const progress = Math.min(Math.floor((page / totalPages) * 100), 99);
      const elapsed = Date.now() - startTime;
      const avgMs = page > 0 ? Math.floor(elapsed / page) : 0;
      await storage.updateFile(fileId, {
        progress,
        totalPages,
        pagesProcessed: page,
        extractedCount: votersSoFar,
        avgPageTimeMs: avgMs,
      });
    });

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
