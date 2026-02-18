import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { processZipFile, processSinglePdfFile } from "./pdf-processor";

const uploadDir = path.join(process.cwd(), "uploads");
const chunksDir = path.join(process.cwd(), "uploads", "chunks");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

const chunkUpload = multer({
  storage: multer.diskStorage({
    destination: chunksDir,
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".zip"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const activeChunkedUploads = new Map<string, { totalChunks: number; receivedChunks: Set<number>; originalName: string; totalSize: number; mimeType: string }>();

declare module "express-serve-static-core" {
  interface Request {
    session?: { userId?: string; username?: string; displayName?: string };
  }
}

const sessions = new Map<string, { userId: string; username: string; displayName: string }>();

function generateSessionId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function authMiddleware(req: Request, res: Response, next: Function) {
  const sessionId = req.headers.cookie
    ?.split(";")
    .find((c) => c.trim().startsWith("session="))
    ?.split("=")[1];

  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.session = sessions.get(sessionId);
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ===== AUTH ROUTES =====
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password, displayName } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        displayName: displayName || username,
        role: "admin",
      });

      const sessionId = generateSessionId();
      sessions.set(sessionId, { userId: user.id, username: user.username, displayName: user.displayName });

      res.cookie("session", sessionId, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });

      await storage.createAuditLog({
        action: "User Registration",
        userId: user.id,
        userName: user.displayName,
        details: `New user registered: ${user.username}`,
        status: "Success",
      });

      return res.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        await storage.createAuditLog({
          action: "Login Attempt",
          userName: username,
          details: `Failed login attempt for ${username}`,
          status: "Failed",
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const sessionId = generateSessionId();
      sessions.set(sessionId, { userId: user.id, username: user.username, displayName: user.displayName });

      res.cookie("session", sessionId, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });

      await storage.createAuditLog({
        action: "Login",
        userId: user.id,
        userName: user.displayName,
        details: `User logged in: ${user.username}`,
        status: "Success",
      });

      return res.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const sessionId = req.headers.cookie
      ?.split(";")
      .find((c) => c.trim().startsWith("session="))
      ?.split("=")[1];

    if (sessionId) {
      sessions.delete(sessionId);
    }
    res.clearCookie("session");
    return res.json({ message: "Logged out" });
  });

  app.get("/api/auth/me", authMiddleware, (req: Request, res: Response) => {
    return res.json(req.session);
  });

  // ===== FILE ROUTES =====
  app.get("/api/files", authMiddleware, async (_req: Request, res: Response) => {
    try {
      const files = await storage.getFiles();
      return res.json(files);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/files/stats", authMiddleware, async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getFileStats();
      return res.json(stats);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/files/upload", authMiddleware, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const file = await storage.createFile({
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        status: "pending",
        progress: 100,
        totalPages: 0,
        pagesProcessed: 0,
        extractedCount: 0,
        uploadedBy: req.session?.userId || null,
      });

      await storage.createAuditLog({
        action: "File Upload",
        userId: req.session?.userId,
        userName: req.session?.displayName,
        details: `Uploaded ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`,
        status: "Success",
      });

      startProcessing(file.id, file.filename, file.originalName);
      return res.json(file);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/files/upload/init", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { fileName, fileSize, totalChunks, mimeType } = req.body;
      if (!fileName || !fileSize || !totalChunks) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const uploadChunkDir = path.join(chunksDir, uploadId);
      fs.mkdirSync(uploadChunkDir, { recursive: true });

      activeChunkedUploads.set(uploadId, {
        totalChunks,
        receivedChunks: new Set(),
        originalName: fileName,
        totalSize: fileSize,
        mimeType: mimeType || "application/octet-stream",
      });

      return res.json({ uploadId, totalChunks });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/files/upload/chunk", authMiddleware, chunkUpload.single("chunk"), async (req: Request, res: Response) => {
    try {
      const { uploadId, chunkIndex } = req.body;
      if (!uploadId || chunkIndex === undefined || !req.file) {
        return res.status(400).json({ message: "Missing uploadId, chunkIndex, or chunk data" });
      }

      const session = activeChunkedUploads.get(uploadId);
      if (!session) {
        return res.status(404).json({ message: "Upload session not found" });
      }

      const idx = parseInt(chunkIndex);
      const destPath = path.join(chunksDir, uploadId, `chunk_${idx}`);
      fs.renameSync(req.file.path, destPath);
      session.receivedChunks.add(idx);

      return res.json({
        received: idx,
        totalReceived: session.receivedChunks.size,
        totalChunks: session.totalChunks,
        complete: session.receivedChunks.size === session.totalChunks,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/files/upload/complete", authMiddleware, async (req: Request, res: Response) => {
    req.setTimeout(600000);
    res.setTimeout(600000);
    try {
      const { uploadId } = req.body;
      if (!uploadId) {
        return res.status(400).json({ message: "Missing uploadId" });
      }

      const session = activeChunkedUploads.get(uploadId);
      if (!session) {
        return res.status(404).json({ message: "Upload session not found" });
      }

      if (session.receivedChunks.size !== session.totalChunks) {
        return res.status(400).json({ 
          message: `Missing chunks: received ${session.receivedChunks.size}/${session.totalChunks}` 
        });
      }

      const finalName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${session.originalName}`;
      const finalPath = path.join(uploadDir, finalName);
      const writeStream = fs.createWriteStream(finalPath);

      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(chunksDir, uploadId, `chunk_${i}`);
        await new Promise<void>((resolve, reject) => {
          const readStream = fs.createReadStream(chunkPath);
          readStream.on("error", reject);
          readStream.on("end", () => {
            fs.unlink(chunkPath, () => {});
            resolve();
          });
          readStream.pipe(writeStream, { end: false });
        });
      }

      writeStream.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      const chunkDir = path.join(chunksDir, uploadId);
      if (fs.existsSync(chunkDir)) {
        fs.rmSync(chunkDir, { recursive: true });
      }

      activeChunkedUploads.delete(uploadId);

      const file = await storage.createFile({
        filename: finalName,
        originalName: session.originalName,
        size: session.totalSize,
        mimeType: session.mimeType,
        status: "pending",
        progress: 100,
        totalPages: 0,
        pagesProcessed: 0,
        extractedCount: 0,
        uploadedBy: req.session?.userId || null,
      });

      await storage.createAuditLog({
        action: "File Upload",
        userId: req.session?.userId,
        userName: req.session?.displayName,
        details: `Uploaded ${session.originalName} (${(session.totalSize / 1024 / 1024).toFixed(2)} MB) via chunked upload`,
        status: "Success",
      });

      startProcessing(file.id, finalName, session.originalName);
      return res.json(file);
    } catch (error: any) {
      console.error("[Upload Complete] Error:", error);
      const msg = error?.message || String(error) || "Unknown upload completion error";
      return res.status(500).json({ message: msg });
    }
  });

  app.post("/api/files/:id/reprocess", authMiddleware, async (req: Request, res: Response) => {
    try {
      const fileId = req.params.id as string;
      const file = await storage.getFile(fileId);
      if (!file) return res.status(404).json({ message: "File not found" });

      await storage.updateFile(fileId, { status: "pending", progress: 0, pagesProcessed: 0, extractedCount: 0, errorMessage: null });

      startProcessing(fileId, file.filename, file.originalName);

      await storage.createAuditLog({
        action: "Reprocessing",
        userId: req.session?.userId,
        userName: req.session?.displayName,
        details: `Reprocessing file ${file.originalName}`,
        status: "Success",
      });

      return res.json({ message: "Reprocessing started" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/files/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const fileId = req.params.id as string;
      const file = await storage.getFile(fileId);
      if (!file) return res.status(404).json({ message: "File not found" });

      const filePath = path.join(uploadDir, file.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await storage.deleteFile(fileId);

      await storage.createAuditLog({
        action: "File Delete",
        userId: req.session?.userId,
        userName: req.session?.displayName,
        details: `Deleted file ${file.originalName}`,
        status: "Success",
      });

      return res.json({ message: "File deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ===== EXCEL DOWNLOAD =====
  app.get("/api/files/:id/download", authMiddleware, async (req: Request, res: Response) => {
    try {
      const fileId = req.params.id as string;
      const file = await storage.getFile(fileId);
      if (!file) return res.status(404).json({ message: "File not found" });

      const wb = XLSX.utils.book_new();
      const headers = [
        "Full Name", "Father/Husband", "EPIC",
        "Gender", "Age", "Address", "Polling Station",
        "Gram", "Thana", "Panchayat", "Block", "Tahsil", "Jilla"
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers]);

      const BATCH = 5000;
      let offset = 0;
      let rowIndex = 1;
      let totalAdded = 0;

      while (true) {
        const batch = await storage.getVoterRecordsByFileIdPaginated(fileId, BATCH, offset);
        if (batch.length === 0) break;

        const rows = batch.map((r) => {
          const addr = r.houseNo ? `House No. ${r.houseNo}` : (r.address || "");
          return [
            r.voterName || "",
            r.relationName || "",
            r.epicNumber || "",
            r.gender || "",
            r.age || "",
            addr,
            r.psName || "",
            r.gram || "",
            r.thana || "",
            r.panchayat || "",
            r.block || "",
            r.tahsil || "",
            r.jilla || "",
          ];
        });

        XLSX.utils.sheet_add_aoa(ws, rows, { origin: rowIndex });
        rowIndex += rows.length;
        totalAdded += batch.length;
        offset += BATCH;

        if (batch.length < BATCH) break;
      }

      if (totalAdded === 0) {
        return res.status(404).json({ message: "No voter records found for this file" });
      }

      const colWidths = [
        { wch: 22 }, { wch: 22 }, { wch: 16 },
        { wch: 8 }, { wch: 6 }, { wch: 18 }, { wch: 30 },
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 },
      ];
      ws["!cols"] = colWidths;

      const safeName = file.originalName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safeName || "Voter Records");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const downloadName = `${file.originalName.replace(/\.[^.]+$/, "")}_voters.xlsx`;

      res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return res.send(buffer);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ===== VOTER RECORD ROUTES =====
  app.get("/api/voters", authMiddleware, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = req.query.search as string;

      const result = await storage.getVoterRecords({ limit, offset, search });
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/voters/stats", authMiddleware, async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getVoterStats();
      return res.json(stats);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/voters/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateVoterRecord(req.params.id as string, req.body);
      if (!updated) return res.status(404).json({ message: "Record not found" });

      await storage.createAuditLog({
        action: "Record Update",
        userId: req.session?.userId,
        userName: req.session?.displayName,
        details: `Updated voter record ${req.params.id}`,
        status: "Success",
      });

      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ===== ANALYTICS ROUTES =====
  app.get("/api/analytics/gender", authMiddleware, async (_req: Request, res: Response) => {
    try {
      const data = await storage.getGenderDistribution();
      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analytics/age", authMiddleware, async (_req: Request, res: Response) => {
    try {
      const data = await storage.getAgeDistribution();
      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analytics/booths", authMiddleware, async (_req: Request, res: Response) => {
    try {
      const data = await storage.getBoothStats();
      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analytics/dashboard", authMiddleware, async (_req: Request, res: Response) => {
    try {
      const [fileStats, voterStats] = await Promise.all([
        storage.getFileStats(),
        storage.getVoterStats(),
      ]);
      return res.json({ fileStats, voterStats });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ===== AUDIT LOG ROUTES =====
  app.get("/api/audit", authMiddleware, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getAuditLogs(limit);
      return res.json(logs);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ===== RECOVER INTERRUPTED PROCESSING =====
  try {
    const files = await storage.getFiles();
    for (const file of files) {
      if (file.status === "processing" || file.status === "uploading") {
        console.log(`Recovering interrupted file: ${file.originalName} (was ${file.status})`);
        await storage.updateFile(file.id, {
          status: "failed",
          errorMessage: "Processing was interrupted by server restart. Click Reprocess to try again.",
        });
      }
    }
  } catch (e) {
    console.log("Recovery check skipped");
  }

  // ===== SEED DEFAULT ADMIN =====
  try {
    const adminExists = await storage.getUserByUsername("admin@ec.gov.in");
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("password", 10);
      await storage.createUser({
        username: "admin@ec.gov.in",
        password: hashedPassword,
        displayName: "Admin Officer",
        role: "admin",
      });
    }
  } catch (e) {
    console.log("Admin seed skipped (may already exist)");
  }

  return httpServer;
}

function startProcessing(fileId: string, filename: string, originalName: string) {
  const filePath = path.join(uploadDir, filename);
  const ext = path.extname(originalName).toLowerCase();

  if (ext === ".zip") {
    processZipFile(filePath, fileId).catch((e) => {
      console.error(`ZIP processing failed for ${fileId}: ${e.message}`);
      storage.updateFile(fileId, { status: "failed", errorMessage: e.message });
    });
  } else if (ext === ".pdf") {
    processSinglePdfFile(filePath, fileId).catch((e) => {
      console.error(`PDF processing failed for ${fileId}: ${e.message}`);
      storage.updateFile(fileId, { status: "failed", errorMessage: e.message });
    });
  } else {
    storage.updateFile(fileId, { status: "failed", errorMessage: `Unsupported file type: ${ext}` });
  }
}
