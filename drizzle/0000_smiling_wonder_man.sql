CREATE TYPE "public"."audit_status" AS ENUM('running', 'complete', 'error');--> statement-breakpoint
CREATE TYPE "public"."claim_type" AS ENUM('factual', 'opinion', 'unknowable');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('pass', 'partial', 'fail', 'fabricated_source', 'confident_fabrication');--> statement-breakpoint
CREATE TABLE "audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"original_prompt" text NOT NULL,
	"target_response" text NOT NULL,
	"target_model" text NOT NULL,
	"interrogator_model" text NOT NULL,
	"adjudicator_model" text NOT NULL,
	"composite_score" integer,
	"verdict" text,
	"calibration_delta" real,
	"calibration_direction" text,
	"hard_fail" boolean DEFAULT false NOT NULL,
	"status" "audit_status" DEFAULT 'running' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"text" text NOT NULL,
	"claim_type" "claim_type" NOT NULL,
	"stated_confidence" integer,
	"survived" real
);
--> statement-breakpoint
CREATE TABLE "dimension_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"raw_score" real NOT NULL,
	"weight" integer NOT NULL,
	"weighted_points" real NOT NULL,
	"probe_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "probes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"claim_id" uuid,
	"probe_type" text NOT NULL,
	"dimension" text NOT NULL,
	"verdict" "verdict",
	"rationale" text,
	"transcript" jsonb
);
--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dimension_scores" ADD CONSTRAINT "dimension_scores_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probes" ADD CONSTRAINT "probes_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probes" ADD CONSTRAINT "probes_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;