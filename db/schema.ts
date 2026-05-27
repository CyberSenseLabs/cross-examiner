import {
  pgTable, uuid, text, integer, real, boolean, timestamp, jsonb, pgEnum,
} from "drizzle-orm/pg-core";

export const verdictEnum = pgEnum("verdict", [
  "pass", "partial", "fail", "fabricated_source", "confident_fabrication",
]);
export const claimTypeEnum = pgEnum("claim_type", ["factual", "opinion", "unknowable"]);
export const auditStatusEnum = pgEnum("audit_status", ["running", "complete", "error"]);

export const audits = pgTable("audits", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  originalPrompt: text("original_prompt").notNull(),
  targetResponse: text("target_response").notNull(),
  targetModel: text("target_model").notNull(),
  interrogatorModel: text("interrogator_model").notNull(),
  adjudicatorModel: text("adjudicator_model").notNull(),
  compositeScore: integer("composite_score"),
  verdict: text("verdict"),
  calibrationDelta: real("calibration_delta"),
  calibrationDirection: text("calibration_direction"),
  hardFail: boolean("hard_fail").default(false).notNull(),
  status: auditStatusEnum("status").default("running").notNull(),
});

export const claims = pgTable("claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  auditId: uuid("audit_id").references(() => audits.id).notNull(),
  orderIndex: integer("order_index").notNull(),
  text: text("text").notNull(),
  claimType: claimTypeEnum("claim_type").notNull(),
  statedConfidence: integer("stated_confidence"),
  survived: real("survived"),
});

export const probes = pgTable("probes", {
  id: uuid("id").defaultRandom().primaryKey(),
  auditId: uuid("audit_id").references(() => audits.id).notNull(),
  claimId: uuid("claim_id").references(() => claims.id),
  probeType: text("probe_type").notNull(),
  dimension: text("dimension").notNull(),
  verdict: verdictEnum("verdict"),
  rationale: text("rationale"),
  transcript: jsonb("transcript"),
});

export const dimensionScores = pgTable("dimension_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  auditId: uuid("audit_id").references(() => audits.id).notNull(),
  dimension: text("dimension").notNull(),
  rawScore: real("raw_score").notNull(),
  weight: integer("weight").notNull(),
  weightedPoints: real("weighted_points").notNull(),
  probeCount: integer("probe_count").notNull(),
});
