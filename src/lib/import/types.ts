export type IssueSeverity = "error" | "warning" | "info";

export type IssueCode =
  | "INVALID_TYPE"
  | "DUPLICATE_ID"
  | "EXISTS_IN_DB"
  | "POSSIBLE_DUPLICATE"
  | "DUPLICATE_NAME"
  | "LEGACY_MISMATCH"
  | "LEGACY_UNMATCHED"
  | "UNKNOWN_LOCATION"
  | "LOCATION_NORMALIZED"
  | "UNKNOWN_STATUS"
  | "MISSING_SERIAL"
  | "MISSING_INVENTORY"
  | "MISSING_ASSET_NO"
  | "MISSING_LOCATION"
  | "VALUE_NORMALIZED"
  | "UNKNOWN_ASSET";

export const ISSUE_META: Record<IssueCode, { label: string; severity: IssueSeverity }> = {
  INVALID_TYPE: { label: "Unknown asset type", severity: "error" },
  DUPLICATE_ID: { label: "Duplicate Asset ID in file", severity: "error" },
  UNKNOWN_ASSET: { label: "Movement for unknown asset", severity: "error" },
  EXISTS_IN_DB: { label: "Already in the system", severity: "info" },
  POSSIBLE_DUPLICATE: { label: "Possible duplicate (same serial / IMEI)", severity: "warning" },
  DUPLICATE_NAME: { label: "Duplicate device name", severity: "warning" },
  LEGACY_MISMATCH: { label: "Legacy sheet disagrees with register", severity: "warning" },
  LEGACY_UNMATCHED: { label: "Legacy row not in register", severity: "warning" },
  UNKNOWN_LOCATION: { label: "Inconsistent / unknown location", severity: "warning" },
  UNKNOWN_STATUS: { label: "Unknown status", severity: "warning" },
  LOCATION_NORMALIZED: { label: "Location name normalised", severity: "info" },
  VALUE_NORMALIZED: { label: "Value normalised", severity: "info" },
  MISSING_SERIAL: { label: "Missing serial / IMEI", severity: "info" },
  MISSING_INVENTORY: { label: "Missing inventory number", severity: "info" },
  MISSING_ASSET_NO: { label: "Missing asset number", severity: "info" },
  MISSING_LOCATION: { label: "Missing location", severity: "info" },
};

export type Issue = { code: IssueCode; message: string };

export type StagedAsset = {
  assetId: string | null; // null → generated at commit
  typeName: string;
  deviceName: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  imei: string | null;
  inventoryNumber: string | null;
  assetNumber: string | null;
  alternateReference: string | null;
  simOperator: string | null;
  simNumber: string | null;
  locationName: string | null;
  locationRaw: string | null;
  assignedTo: string | null;
  shift: string | null;
  statusName: string;
  condition: string | null;
  issuedDate: string | null;
  receivedDate: string | null;
  lastOsUpdate: string | null;
  lastVerified: string | null;
  remarks: string | null;
  attributes: Record<string, string | number | boolean | null>;
  repairs: { date: string | null; text: string }[];
};

export type StagedRow = {
  key: string;
  kind: "asset";
  sheet: string;
  rowNumber: number;
  sourceRef: string;
  data: StagedAsset;
  /** Original cell values, preserved verbatim (stored on the asset as legacy_data) */
  raw: Record<string, unknown>;
  legacy: { sheet: string; row: number; raw: Record<string, unknown> }[];
  issues: Issue[];
  /** Default decision; the administrator can override per row on the review screen */
  include: boolean;
};

export type StagedMovement = {
  key: string;
  kind: "movement";
  sheet: string;
  rowNumber: number;
  date: string;
  assetId: string;
  action: string;
  from: string | null;
  to: string | null;
  assignedTo: string | null;
  doneBy: string | null;
  notes: string | null;
  issues: Issue[];
  include: boolean;
};

export type ReferenceAdditions = {
  locations: string[];
  statuses: string[];
  simOperators: string[];
  brands: string[];
};

export type ImportSummary = {
  fileName: string;
  sheetsFound: string[];
  sheetsIgnored: string[];
  byType: Record<string, number>;
  totalAssets: number;
  movements: number;
  ignoredRows: { sheet: string; row: number; reason: string }[];
  issueCounts: Partial<Record<IssueCode, number>>;
  referenceAdditions: ReferenceAdditions;
  mode: "register" | "legacy";
};

export type StagedImport = {
  summary: ImportSummary;
  rows: StagedRow[];
  movements: StagedMovement[];
};

export function rowSeverity(issues: Issue[]): IssueSeverity | null {
  let worst: IssueSeverity | null = null;
  for (const i of issues) {
    const s = ISSUE_META[i.code].severity;
    if (s === "error") return "error";
    if (s === "warning") worst = "warning";
    else if (!worst) worst = "info";
  }
  return worst;
}
