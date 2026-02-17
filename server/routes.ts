import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".zip"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

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

      // Simulate processing in background
      simulateProcessing(file.id);

      return res.json(file);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/files/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const file = await storage.getFile(req.params.id);
      if (!file) return res.status(404).json({ message: "File not found" });

      const filePath = path.join(uploadDir, file.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await storage.deleteFile(req.params.id);

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
      const updated = await storage.updateVoterRecord(req.params.id, req.body);
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

async function simulateProcessing(fileId: string) {
  const voterNames = [
    "Aarav Sharma", "Vivaan Singh", "Aditya Kumar", "Vihaan Gupta", "Arjun Patel",
    "Sai Reddy", "Reyansh Joshi", "Ayaan Malhotra", "Krishna Verma", "Ishaan Bhat",
    "Priya Sharma", "Ananya Singh", "Divya Patel", "Meera Gupta", "Kavya Reddy",
  ];
  const relationNames = [
    "Rajesh Sharma", "Amit Singh", "Suresh Kumar", "Manoj Gupta", "Vikram Patel",
    "Ramesh Reddy", "Sanjay Joshi", "Deepak Malhotra", "Vijay Verma", "Anil Bhat",
  ];

  const totalPages = 10 + Math.floor(Math.random() * 30);

  await storage.updateFile(fileId, { status: "processing", totalPages, progress: 0 });

  for (let page = 1; page <= totalPages; page++) {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));

    const votersOnPage = 3 + Math.floor(Math.random() * 8);
    const records = Array.from({ length: votersOnPage }).map((_, i) => ({
      fileId,
      serialNumber: (page - 1) * 10 + i + 1,
      epicNumber: `GDN${Math.floor(1000000 + Math.random() * 9000000)}`,
      voterName: voterNames[Math.floor(Math.random() * voterNames.length)],
      relationName: relationNames[Math.floor(Math.random() * relationNames.length)],
      gender: Math.random() > 0.48 ? "Male" : "Female",
      age: 18 + Math.floor(Math.random() * 60),
      address: `${Math.floor(Math.random() * 100) + 1}, Gandhi Nagar, Sector ${Math.floor(Math.random() * 20) + 1}, New Delhi`,
      boothNumber: `Booth ${100 + Math.floor(Math.random() * 10)}`,
      partNumber: `AC-${100 + Math.floor(page / 5)}`,
      constituency: "New Delhi Central",
      state: "Delhi",
      status: Math.random() > 0.85 ? ("flagged" as const) : ("verified" as const),
    }));

    try {
      await storage.createVoterRecordsBatch(records);
    } catch (e) {}

    const progress = Math.floor((page / totalPages) * 100);
    await storage.updateFile(fileId, {
      pagesProcessed: page,
      progress,
      extractedCount: (page * votersOnPage),
    });
  }

  await storage.updateFile(fileId, { status: "completed", progress: 100, pagesProcessed: totalPages });
}
