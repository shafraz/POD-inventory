-- Asset Register layout (Oct 2026): canonical locations, units, shifts and status names.
-- Existing values that don't fit the new lists are preserved in the *_remark columns.

-- 1. Asset type prefixes used for new IDs (Tab8-26-001). Existing asset IDs are unchanged.
UPDATE "asset_types" SET "prefix" = 'Tab8'  WHERE "prefix" = 'TAB8';
UPDATE "asset_types" SET "prefix" = 'Tab10' WHERE "prefix" = 'TAB10';
UPDATE "asset_types" SET "config" = jsonb_set("config", '{labels}', COALESCE("config"->'labels', '{}'::jsonb) - 'inventoryNumber' - 'shift')
 WHERE "prefix" = 'VHF';

-- 2. Status names
UPDATE "statuses" SET "name" = 'In use'     WHERE "code" = 'IN_USE'     AND "name" = 'In Use';
UPDATE "statuses" SET "name" = 'In stock'   WHERE "code" = 'IN_STOCK'   AND "name" = 'In Stock';
UPDATE "statuses" SET "name" = 'Not in use' WHERE "code" = 'NOT_IN_USE' AND "name" = 'Not in Use';

-- 3. Locations: MCH, THT, HMT, Others
INSERT INTO "locations" ("id", "name", "aliases", "active", "sort_order", "created_at", "updated_at") VALUES
  (gen_random_uuid()::text, 'MCH', '{}', true, 0, now(), now()),
  (gen_random_uuid()::text, 'THT', '{Thilafushi}', true, 1, now(), now()),
  (gen_random_uuid()::text, 'HMT', '{}', true, 2, now(), now()),
  (gen_random_uuid()::text, 'Others', '{Other}', true, 3, now(), now())
ON CONFLICT ("name") DO NOTHING;
UPDATE "locations" SET "active" = true, "sort_order" = CASE "name" WHEN 'MCH' THEN 0 WHEN 'THT' THEN 1 WHEN 'HMT' THEN 2 ELSE 3 END
 WHERE "name" IN ('MCH', 'THT', 'HMT', 'Others');
UPDATE "locations" SET "aliases" = '{Thilafushi}' WHERE "name" = 'THT';

UPDATE "assets" a
   SET "location_id" = (SELECT n."id" FROM "locations" n WHERE n."name" =
         CASE lower(l."name") WHEN 'thilafushi' THEN 'THT' WHEN 'pod-mch' THEN 'MCH' WHEN 'pod-hmt' THEN 'HMT' ELSE 'Others' END),
       "location_remark" = CASE WHEN lower(l."name") = 'thilafushi' THEN a."location_remark" ELSE l."name" END
  FROM "locations" l
 WHERE a."location_id" = l."id" AND l."name" NOT IN ('MCH', 'THT', 'HMT', 'Others');

-- Old locations stay in the database (history refers to them by name) but are hidden from dropdowns.
UPDATE "locations" SET "active" = false WHERE "name" NOT IN ('MCH', 'THT', 'HMT', 'Others');

-- 4. Assigned To → unit list. Staff-held assets show the person separately ("Held by").
UPDATE "assets" SET "assigned_to" = NULL WHERE "staff_id" IS NOT NULL;
UPDATE "assets"
   SET "assigned_to_remark" = CASE WHEN lower("assigned_to") IN ('tally','forman','grd ic','duty ic','yard office','ops office','gear store','admin','digital unit','others') THEN NULL ELSE "assigned_to" END,
       "assigned_to" = CASE
         WHEN lower("assigned_to") = 'tally'        THEN 'Tally'
         WHEN lower("assigned_to") = 'forman'       THEN 'Forman'
         WHEN lower("assigned_to") = 'grd ic'       THEN 'Grd IC'
         WHEN lower("assigned_to") = 'duty ic'      THEN 'Duty IC'
         WHEN lower("assigned_to") = 'yard office'  THEN 'Yard office'
         WHEN lower("assigned_to") = 'ops office'   THEN 'Ops Office'
         WHEN lower("assigned_to") = 'gear store'   THEN 'Gear Store'
         WHEN lower("assigned_to") = 'admin'        THEN 'Admin'
         WHEN lower("assigned_to") = 'digital unit' THEN 'Digital unit'
         WHEN "assigned_to" ~* 'tall(y|ies)'        THEN 'Tally'
         WHEN "assigned_to" ~* '^gear'              THEN 'Gear Store'
         ELSE 'Others' END
 WHERE "assigned_to" IS NOT NULL AND btrim("assigned_to") <> '';

-- 5. Shifts: A, B, C, All morning
UPDATE "assets" SET "shift" = CASE "shift" WHEN 'A Shift' THEN 'A' WHEN 'B Shift' THEN 'B' WHEN 'C Shift' THEN 'C' WHEN 'General' THEN 'All morning' ELSE "shift" END
 WHERE "shift" IN ('A Shift', 'B Shift', 'C Shift', 'General');
UPDATE "staff" SET "shift" = CASE "shift" WHEN 'A Shift' THEN 'A' WHEN 'B Shift' THEN 'B' WHEN 'C Shift' THEN 'C' WHEN 'General' THEN 'All morning' ELSE "shift" END
 WHERE "shift" IN ('A Shift', 'B Shift', 'C Shift', 'General');

-- 6. Dropdown lists
DELETE FROM "lookup_values" WHERE "category" = 'SHIFT';
INSERT INTO "lookup_values" ("id", "category", "value", "active", "sort_order") VALUES
  (gen_random_uuid()::text, 'SHIFT', 'A', true, 0),
  (gen_random_uuid()::text, 'SHIFT', 'B', true, 1),
  (gen_random_uuid()::text, 'SHIFT', 'C', true, 2),
  (gen_random_uuid()::text, 'SHIFT', 'All morning', true, 3),
  (gen_random_uuid()::text, 'ASSIGNED_TO', 'Tally', true, 0),
  (gen_random_uuid()::text, 'ASSIGNED_TO', 'Forman', true, 1),
  (gen_random_uuid()::text, 'ASSIGNED_TO', 'Grd IC', true, 2),
  (gen_random_uuid()::text, 'ASSIGNED_TO', 'Duty IC', true, 3),
  (gen_random_uuid()::text, 'ASSIGNED_TO', 'Yard office', true, 4),
  (gen_random_uuid()::text, 'ASSIGNED_TO', 'Ops Office', true, 5),
  (gen_random_uuid()::text, 'ASSIGNED_TO', 'Gear Store', true, 6),
  (gen_random_uuid()::text, 'ASSIGNED_TO', 'Admin', true, 7),
  (gen_random_uuid()::text, 'ASSIGNED_TO', 'Digital unit', true, 8),
  (gen_random_uuid()::text, 'ASSIGNED_TO', 'Others', true, 9),
  (gen_random_uuid()::text, 'SIM_OPERATOR', 'Ooredoo 20GB', true, 10)
ON CONFLICT ("category", "value") DO NOTHING;

-- Keep new tables/columns protected from Supabase's public Data API
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
