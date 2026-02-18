import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, bigint, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("user_role", ["admin", "candidate", "worker"]);
export const fileStatusEnum = pgEnum("file_status", ["pending", "uploading", "processing", "completed", "failed"]);
export const voterStatusEnum = pgEnum("voter_status", ["verified", "flagged", "incomplete"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: roleEnum("role").notNull().default("admin"),
});

export const uploadedFiles = pgTable("uploaded_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  mimeType: text("mime_type").notNull(),
  status: fileStatusEnum("status").notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  totalPages: integer("total_pages").default(0),
  pagesProcessed: integer("pages_processed").default(0),
  extractedCount: integer("extracted_count").default(0),
  skippedPages: integer("skipped_pages").default(0),
  errorMessage: text("error_message"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processingStartedAt: timestamp("processing_started_at"),
  avgPageTimeMs: integer("avg_page_time_ms"),
});

export const voterRecords = pgTable("voter_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: varchar("file_id").references(() => uploadedFiles.id),
  serialNumber: integer("serial_number"),
  epicNumber: text("epic_number"),
  voterName: text("voter_name").notNull(),
  voterNameEn: text("voter_name_en"),
  relationType: text("relation_type"),
  relationName: text("relation_name"),
  relationNameEn: text("relation_name_en"),
  gender: text("gender"),
  age: integer("age"),
  houseNo: text("house_no"),
  address: text("address"),
  boothNumber: text("booth_number"),
  partNumber: text("part_number"),
  acNoName: text("ac_no_name"),
  constituency: text("constituency"),
  sectionNumber: text("section_number"),
  sectionName: text("section_name"),
  sectionNameEn: text("section_name_en"),
  psName: text("ps_name"),
  state: text("state"),
  gram: text("gram"),
  thana: text("thana"),
  panchayat: text("panchayat"),
  block: text("block"),
  tahsil: text("tahsil"),
  jilla: text("jilla"),
  status: voterStatusEnum("status").notNull().default("verified"),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  userId: varchar("user_id").references(() => users.id),
  userName: text("user_name"),
  details: text("details"),
  status: text("status").notNull().default("Success"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertFileSchema = createInsertSchema(uploadedFiles).omit({ id: true, createdAt: true });
export const insertVoterSchema = createInsertSchema(voterRecords).omit({ id: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertVoter = z.infer<typeof insertVoterSchema>;
export type VoterRecord = typeof voterRecords.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export * from "./models/chat";
