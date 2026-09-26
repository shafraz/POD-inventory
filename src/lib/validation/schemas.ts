import { z } from "zod";

/** Optional trimmed string → null when blank. */
export const optStr = (max = 500) =>
  z
    .string()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : null));

export const reqStr = (label: string, max = 200) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);

/** "YYYY-MM-DD" or blank. */
export const optDate = z
  .string()
  .optional()
  .nullable()
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid date")
  .transform((v) => (v ? v : null));

export const reqDate = (label = "Date") =>
  z.string({ error: `${label} is required` }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} is required`);

// ── Assets ─────────────────────────────────────────────────────

export const assetInputSchema = z.object({
  assetTypeId: reqStr("Asset type"),
  deviceName: reqStr("Device name / code"),
  brand: optStr(100),
  model: optStr(100),
  serialNumber: optStr(100),
  imei: optStr(30).refine((v) => !v || /^[0-9A-Za-z\- ]{6,30}$/.test(v), "IMEI looks invalid"),
  inventoryNumber: optStr(100),
  assetNumber: optStr(100),
  alternateReference: optStr(100),
  simOperator: optStr(100),
  simNumber: optStr(50),
  locationId: optStr(50),
  assignedTo: optStr(150),
  shift: optStr(50),
  department: optStr(100),
  statusId: reqStr("Status"),
  condition: optStr(50),
  lastOsUpdate: optDate,
  osVersion: optStr(100),
  lastServiceDate: optDate,
  nextVerificationDate: optDate,
  receivedDate: optDate,
  remarks: optStr(2000),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});
export type AssetInput = z.infer<typeof assetInputSchema>;

export const assetUpdateSchema = assetInputSchema.extend({ id: reqStr("Asset") });

// ── Movements ──────────────────────────────────────────────────

const base = {
  assetId: reqStr("Asset"),
  date: reqDate(),
  doneBy: optStr(150),
  notes: optStr(2000),
  /** Set when an officer is actioning an Operations User's request */
  requestId: optStr(50),
};

export const requestSchema = z.object({
  type: z.enum(["ISSUE", "TRANSFER", "RETURN", "REPAIR"]),
  assetId: reqStr("Asset"),
  toLocationId: optStr(50),
  staffId: optStr(50),
  assignedTo: optStr(150),
  shift: optStr(50),
  problem: optStr(1000),
  notes: optStr(2000),
});

export const issueSchema = z
  .object({
    ...base,
    toLocationId: reqStr("To location"),
    staffId: optStr(50),
    assignedTo: optStr(150),
    shift: optStr(50),
    department: optStr(100),
  })
  .refine((v) => v.staffId || v.assignedTo, { message: "Choose a staff member or enter who it is assigned to", path: ["assignedTo"] });

export const transferSchema = z.object({
  ...base,
  toLocationId: reqStr("New location"),
  staffId: optStr(50),
  assignedTo: optStr(150),
  shift: optStr(50),
  reason: optStr(500),
});

export const returnSchema = z.object({
  ...base,
  toLocationId: reqStr("Return location"),
  returnedBy: optStr(150),
  condition: optStr(50),
});

export const disposeSchema = z.object({
  ...base,
  reason: reqStr("Reason", 500),
  confirm: z.literal(true, { error: "Disposal must be confirmed" }),
});

export const lostSchema = z.object({
  ...base,
  reason: reqStr("Reason", 500),
});

export const statusChangeSchema = z.object({
  ...base,
  statusId: reqStr("Status"),
  reason: optStr(500),
});

export const repairOutSchema = z.object({
  ...base,
  reportedProblem: reqStr("Reported problem", 1000),
  condition: optStr(50),
  sentBy: optStr(150),
  technician: optStr(150),
  expectedReturnDate: optDate,
});

export const repairInSchema = z.object({
  ...base,
  repairCompleted: z.boolean(),
  repairDescription: optStr(1000),
  partsReplaced: optStr(500),
  cost: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (!isNaN(v) && v >= 0), "Cost must be a positive number"),
  technician: optStr(150),
  conditionAfter: optStr(50),
  statusAfterId: optStr(50),
  toLocationId: optStr(50),
});

export const damageSchema = z.object({
  ...base,
  description: reqStr("Damage description", 1000),
  severity: z.enum(["MINOR", "MODERATE", "MAJOR", "CRITICAL"]),
  reportedBy: optStr(150),
  location: optStr(150),
});

export const verifySchema = z.object({
  ...base,
  physicalLocationId: optStr(50),
  assignedUser: optStr(150),
  condition: optStr(50),
  devicePresent: z.boolean(),
  serialConfirmed: z.boolean(),
  assetNumberConfirmed: z.boolean(),
  locationMatches: z.boolean(),
  assignmentMatches: z.boolean(),
  conditionChecked: z.boolean(),
  result: z.enum(["VERIFIED", "DISCREPANCY", "NOT_FOUND"]),
  statusAfterId: optStr(50),
  updateRegister: z.boolean().default(true),
});

export const osUpdateSchema = z.object({
  ...base,
  osVersion: optStr(100),
});

export const bulkVerifySchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one asset"),
  date: reqDate(),
  notes: optStr(500),
});

export const bulkStatusSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one asset"),
  statusId: reqStr("Status"),
  reason: optStr(500),
});

// ── Staff ──────────────────────────────────────────────────────

export const staffSchema = z.object({
  id: optStr(50),
  name: reqStr("Staff name", 120),
  employeeNumber: z
    .string({ error: "Employee number is required" })
    .trim()
    .min(1, "Employee number is required")
    .max(40)
    .transform((v) => v.toUpperCase()),
  designation: optStr(100),
  shift: optStr(50),
  department: optStr(100),
  phone: optStr(40),
  notes: optStr(500),
  active: z.boolean().default(true),
});
export type StaffInput = z.infer<typeof staffSchema>;
