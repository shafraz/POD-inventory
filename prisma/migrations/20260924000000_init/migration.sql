-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'INVENTORY_OFFICER', 'OPERATIONS_USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "StatusCode" AS ENUM ('IN_USE', 'IN_STOCK', 'UNDER_REPAIR', 'DAMAGED', 'UNVERIFIED', 'NOT_IN_USE', 'DISPOSED', 'LOST', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MovementAction" AS ENUM ('ISSUE', 'RETURN', 'TRANSFER', 'REPAIR_OUT', 'REPAIR_IN', 'MARK_DAMAGED', 'VERIFIED', 'DISPOSE', 'MARK_LOST', 'OS_UPDATE', 'STATUS_CHANGE', 'REGISTERED');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('OPEN', 'COMPLETED', 'NOT_REPAIRABLE');

-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "VerificationResult" AS ENUM ('VERIFIED', 'DISCREPANCY', 'NOT_FOUND');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('ISSUE', 'TRANSFER', 'RETURN', 'REPAIR');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LookupCategory" AS ENUM ('CONDITION', 'DEPARTMENT', 'SHIFT', 'SIM_OPERATOR', 'BRAND');

-- CreateEnum
CREATE TYPE "RecordSource" AS ENUM ('APP', 'IMPORT');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('STAGED', 'COMMITTED', 'DISCARDED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statuses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" "StatusCode" NOT NULL DEFAULT 'CUSTOM',
    "color" TEXT NOT NULL DEFAULT 'gray',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookup_values" (
    "id" TEXT NOT NULL,
    "category" "LookupCategory" NOT NULL,
    "value" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lookup_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "asset_type_id" TEXT NOT NULL,
    "device_name" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "imei" TEXT,
    "inventory_number" TEXT,
    "asset_number" TEXT,
    "alternate_reference" TEXT,
    "sim_number" TEXT,
    "sim_operator" TEXT,
    "location_id" TEXT,
    "assigned_to" TEXT,
    "department" TEXT,
    "shift" TEXT,
    "status_id" TEXT NOT NULL,
    "condition" TEXT,
    "received_date" DATE,
    "issued_date" DATE,
    "last_service_date" DATE,
    "last_verification_date" DATE,
    "next_verification_date" DATE,
    "last_os_update" DATE,
    "os_version" TEXT,
    "remarks" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "review_notes" TEXT,
    "source" "RecordSource" NOT NULL DEFAULT 'APP',
    "source_ref" TEXT,
    "legacy_data" JSONB,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movements" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "action" "MovementAction" NOT NULL,
    "date" DATE NOT NULL,
    "from_location" TEXT,
    "to_location" TEXT,
    "from_assignee" TEXT,
    "assigned_to" TEXT,
    "shift" TEXT,
    "status_before" TEXT,
    "status_after" TEXT,
    "done_by" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recorded_by_id" TEXT,
    "source" "RecordSource" NOT NULL DEFAULT 'APP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repairs" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "status" "RepairStatus" NOT NULL DEFAULT 'OPEN',
    "repair_out_date" DATE,
    "reported_problem" TEXT,
    "condition_out" TEXT,
    "sent_by" TEXT,
    "technician" TEXT,
    "expected_return_date" DATE,
    "status_before" TEXT,
    "repair_in_date" DATE,
    "repair_description" TEXT,
    "parts_replaced" TEXT,
    "cost" DECIMAL(12,2),
    "condition_after" TEXT,
    "notes" TEXT,
    "source" "RecordSource" NOT NULL DEFAULT 'APP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "verification_date" DATE NOT NULL,
    "physical_location" TEXT,
    "assigned_user" TEXT,
    "device_present" BOOLEAN NOT NULL DEFAULT false,
    "serial_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "asset_number_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "location_matches" BOOLEAN NOT NULL DEFAULT false,
    "assignment_matches" BOOLEAN NOT NULL DEFAULT false,
    "condition_checked" BOOLEAN NOT NULL DEFAULT false,
    "condition" TEXT,
    "result" "VerificationResult" NOT NULL,
    "verified_by" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damage_reports" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "DamageSeverity" NOT NULL,
    "reported_by" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "damage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "os_updates" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "update_date" DATE NOT NULL,
    "os_version" TEXT,
    "updated_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "os_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT,
    "damage_report_id" TEXT,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_requests" (
    "id" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "asset_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "review_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT,
    "asset_id" TEXT,
    "asset_code" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "audience" "Role"[] DEFAULT ARRAY['ADMIN', 'INVENTORY_OFFICER']::"Role"[],
    "dedupe_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_reads" (
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("notification_id","user_id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'STAGED',
    "summary" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "created_by_id" TEXT,
    "committed_at" TIMESTAMP(3),
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_types_name_key" ON "asset_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "asset_types_prefix_key" ON "asset_types"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_key" ON "locations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "statuses_name_key" ON "statuses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_values_category_value_key" ON "lookup_values"("category", "value");

-- CreateIndex
CREATE UNIQUE INDEX "assets_asset_id_key" ON "assets"("asset_id");

-- CreateIndex
CREATE INDEX "assets_asset_type_id_idx" ON "assets"("asset_type_id");

-- CreateIndex
CREATE INDEX "assets_location_id_idx" ON "assets"("location_id");

-- CreateIndex
CREATE INDEX "assets_status_id_idx" ON "assets"("status_id");

-- CreateIndex
CREATE INDEX "assets_serial_number_idx" ON "assets"("serial_number");

-- CreateIndex
CREATE INDEX "assets_imei_idx" ON "assets"("imei");

-- CreateIndex
CREATE INDEX "assets_inventory_number_idx" ON "assets"("inventory_number");

-- CreateIndex
CREATE INDEX "assets_asset_number_idx" ON "assets"("asset_number");

-- CreateIndex
CREATE INDEX "assets_next_verification_date_idx" ON "assets"("next_verification_date");

-- CreateIndex
CREATE INDEX "movements_asset_id_date_idx" ON "movements"("asset_id", "date");

-- CreateIndex
CREATE INDEX "movements_action_idx" ON "movements"("action");

-- CreateIndex
CREATE INDEX "movements_date_idx" ON "movements"("date");

-- CreateIndex
CREATE INDEX "repairs_asset_id_idx" ON "repairs"("asset_id");

-- CreateIndex
CREATE INDEX "repairs_status_idx" ON "repairs"("status");

-- CreateIndex
CREATE INDEX "verifications_asset_id_verification_date_idx" ON "verifications"("asset_id", "verification_date");

-- CreateIndex
CREATE INDEX "damage_reports_asset_id_idx" ON "damage_reports"("asset_id");

-- CreateIndex
CREATE INDEX "os_updates_asset_id_idx" ON "os_updates"("asset_id");

-- CreateIndex
CREATE INDEX "asset_requests_status_idx" ON "asset_requests"("status");

-- CreateIndex
CREATE INDEX "audit_logs_asset_id_idx" ON "audit_logs"("asset_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "os_updates" ADD CONSTRAINT "os_updates_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_damage_report_id_fkey" FOREIGN KEY ("damage_report_id") REFERENCES "damage_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- Audit trail is append-only: block UPDATE and DELETE at the DB level
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% not permitted)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
