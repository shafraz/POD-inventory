-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "staff_id" TEXT;

-- AlterTable
ALTER TABLE "movements" ADD COLUMN     "staff_id" TEXT;

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "employee_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "shift" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_employee_number_key" ON "staff"("employee_number");

-- CreateIndex
CREATE INDEX "staff_name_idx" ON "staff"("name");

-- CreateIndex
CREATE INDEX "assets_staff_id_idx" ON "assets"("staff_id");

-- CreateIndex
CREATE INDEX "movements_staff_id_idx" ON "movements"("staff_id");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

