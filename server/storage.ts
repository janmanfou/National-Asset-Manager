import { 
  type User, type InsertUser,
  type UploadedFile, type InsertFile,
  type VoterRecord, type InsertVoter,
  type AuditLog, type InsertAuditLog,
  users, uploadedFiles, voterRecords, auditLogs
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, count, and, gte, lte, ilike, or } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Files
  getFiles(): Promise<UploadedFile[]>;
  getFile(id: string): Promise<UploadedFile | undefined>;
  createFile(file: InsertFile): Promise<UploadedFile>;
  updateFile(id: string, data: Partial<InsertFile>): Promise<UploadedFile | undefined>;
  deleteFile(id: string): Promise<void>;
  getFileStats(): Promise<{ total: number; completed: number; failed: number; pending: number }>;

  // Voter Records
  getVoterRecords(options?: { limit?: number; offset?: number; search?: string }): Promise<{ records: VoterRecord[]; total: number }>;
  getVoterRecord(id: string): Promise<VoterRecord | undefined>;
  createVoterRecord(record: InsertVoter): Promise<VoterRecord>;
  createVoterRecordsBatch(records: InsertVoter[]): Promise<VoterRecord[]>;
  updateVoterRecord(id: string, data: Partial<InsertVoter>): Promise<VoterRecord | undefined>;
  deleteVoterRecord(id: string): Promise<void>;
  getVoterStats(): Promise<{ total: number; verified: number; flagged: number; incomplete: number }>;
  getGenderDistribution(): Promise<{ gender: string; count: number }[]>;
  getAgeDistribution(): Promise<{ ageGroup: string; count: number }[]>;
  getBoothStats(): Promise<{ boothNumber: string; count: number }[]>;

  getVoterRecordsByFileId(fileId: string): Promise<VoterRecord[]>;
  getVoterRecordsByFileIdPaginated(fileId: string, limit: number, offset: number): Promise<VoterRecord[]>;
  deleteVoterRecordsByFileId(fileId: string): Promise<void>;

  // Audit Logs
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Files
  async getFiles(): Promise<UploadedFile[]> {
    return db.select().from(uploadedFiles).orderBy(desc(uploadedFiles.createdAt));
  }

  async getFile(id: string): Promise<UploadedFile | undefined> {
    const [file] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id));
    return file;
  }

  async createFile(file: InsertFile): Promise<UploadedFile> {
    const [created] = await db.insert(uploadedFiles).values(file).returning();
    return created;
  }

  async updateFile(id: string, data: Partial<InsertFile>): Promise<UploadedFile | undefined> {
    const [updated] = await db.update(uploadedFiles).set(data).where(eq(uploadedFiles.id, id)).returning();
    return updated;
  }

  async deleteFile(id: string): Promise<void> {
    await db.delete(uploadedFiles).where(eq(uploadedFiles.id, id));
  }

  async getFileStats(): Promise<{ total: number; completed: number; failed: number; pending: number }> {
    const results = await db.select({
      status: uploadedFiles.status,
      count: count(),
    }).from(uploadedFiles).groupBy(uploadedFiles.status);

    const stats = { total: 0, completed: 0, failed: 0, pending: 0 };
    for (const r of results) {
      const c = Number(r.count);
      stats.total += c;
      if (r.status === "completed") stats.completed = c;
      else if (r.status === "failed") stats.failed = c;
      else if (r.status === "pending") stats.pending = c;
    }
    return stats;
  }

  // Voter Records
  async getVoterRecords(options?: { limit?: number; offset?: number; search?: string }): Promise<{ records: VoterRecord[]; total: number }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    let whereClause;
    if (options?.search) {
      const search = `%${options.search}%`;
      whereClause = or(
        ilike(voterRecords.voterName, search),
        ilike(voterRecords.epicNumber, search),
        ilike(voterRecords.address, search)
      );
    }

    const [records, totalResult] = await Promise.all([
      db.select().from(voterRecords)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(voterRecords.serialNumber),
      db.select({ count: count() }).from(voterRecords).where(whereClause),
    ]);

    return { records, total: Number(totalResult[0].count) };
  }

  async getVoterRecord(id: string): Promise<VoterRecord | undefined> {
    const [record] = await db.select().from(voterRecords).where(eq(voterRecords.id, id));
    return record;
  }

  async createVoterRecord(record: InsertVoter): Promise<VoterRecord> {
    const [created] = await db.insert(voterRecords).values(record).returning();
    return created;
  }

  async createVoterRecordsBatch(records: InsertVoter[]): Promise<VoterRecord[]> {
    if (records.length === 0) return [];
    return db.insert(voterRecords).values(records).returning();
  }

  async updateVoterRecord(id: string, data: Partial<InsertVoter>): Promise<VoterRecord | undefined> {
    const [updated] = await db.update(voterRecords).set(data).where(eq(voterRecords.id, id)).returning();
    return updated;
  }

  async deleteVoterRecord(id: string): Promise<void> {
    await db.delete(voterRecords).where(eq(voterRecords.id, id));
  }

  async getVoterStats(): Promise<{ total: number; verified: number; flagged: number; incomplete: number }> {
    const results = await db.select({
      status: voterRecords.status,
      count: count(),
    }).from(voterRecords).groupBy(voterRecords.status);

    const stats = { total: 0, verified: 0, flagged: 0, incomplete: 0 };
    for (const r of results) {
      const c = Number(r.count);
      stats.total += c;
      if (r.status === "verified") stats.verified = c;
      else if (r.status === "flagged") stats.flagged = c;
      else if (r.status === "incomplete") stats.incomplete = c;
    }
    return stats;
  }

  async getGenderDistribution(): Promise<{ gender: string; count: number }[]> {
    const results = await db.select({
      gender: voterRecords.gender,
      count: count(),
    }).from(voterRecords).groupBy(voterRecords.gender);
    return results.map(r => ({ gender: r.gender ?? "Unknown", count: Number(r.count) }));
  }

  async getAgeDistribution(): Promise<{ ageGroup: string; count: number }[]> {
    const results = await db.execute(sql`
      SELECT 
        CASE 
          WHEN age BETWEEN 18 AND 25 THEN '18-25'
          WHEN age BETWEEN 26 AND 40 THEN '26-40'
          WHEN age BETWEEN 41 AND 60 THEN '41-60'
          WHEN age > 60 THEN '60+'
          ELSE 'Unknown'
        END as age_group,
        COUNT(*) as count
      FROM voter_records
      GROUP BY age_group
      ORDER BY age_group
    `);
    return (results.rows as any[]).map(r => ({ ageGroup: r.age_group, count: Number(r.count) }));
  }

  async getBoothStats(): Promise<{ boothNumber: string; count: number }[]> {
    const results = await db.select({
      boothNumber: voterRecords.boothNumber,
      count: count(),
    }).from(voterRecords).where(sql`${voterRecords.boothNumber} IS NOT NULL`).groupBy(voterRecords.boothNumber).orderBy(desc(count()));
    return results.map(r => ({ boothNumber: r.boothNumber ?? "Unknown", count: Number(r.count) }));
  }

  async getVoterRecordsByFileId(fileId: string): Promise<VoterRecord[]> {
    return db.select().from(voterRecords).where(eq(voterRecords.fileId, fileId)).orderBy(voterRecords.serialNumber);
  }

  async getVoterRecordsByFileIdPaginated(fileId: string, limit: number, offset: number): Promise<VoterRecord[]> {
    return db.select().from(voterRecords)
      .where(eq(voterRecords.fileId, fileId))
      .orderBy(voterRecords.serialNumber)
      .limit(limit)
      .offset(offset);
  }

  async deleteVoterRecordsByFileId(fileId: string): Promise<void> {
    await db.delete(voterRecords).where(eq(voterRecords.fileId, fileId));
  }

  // Audit Logs
  async getAuditLogs(limit = 50): Promise<AuditLog[]> {
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
