/**
 * Asset types are configured in the database (asset_types.config).
 * New tablet models, radios, etc. are added by an administrator — no code change.
 */
export type ExtraFieldType = "text" | "number" | "select" | "date" | "boolean";

export type ExtraField = {
  key: string;
  label: string;
  type: ExtraFieldType;
  options?: string[];
};

export type CoreLabelKey =
  | "deviceName"
  | "serialNumber"
  | "imei"
  | "inventoryNumber"
  | "assetNumber"
  | "alternateReference"
  | "shift";

export type AssetTypeConfig = {
  /** Override display labels for core fields (e.g. VHF: deviceName → "Local Code") */
  labels?: Partial<Record<CoreLabelKey, string>>;
  /** Primary identifier the device carries */
  identifier?: "imei" | "serial";
  hasSim?: boolean;
  hasOs?: boolean;
  /** Device names are expected to be unique within this type (used for duplicate checks) */
  uniqueName?: boolean;
  extraFields?: ExtraField[];
};

export const CORE_LABELS: Record<CoreLabelKey, string> = {
  deviceName: "Device Name / Code",
  serialNumber: "Serial Number",
  imei: "IMEI",
  inventoryNumber: "Inventory Number",
  assetNumber: "Asset Number",
  alternateReference: "Alt. Reference No.",
  shift: "Shift",
};

export function parseTypeConfig(raw: unknown): AssetTypeConfig {
  if (!raw || typeof raw !== "object") return {};
  return raw as AssetTypeConfig;
}

export function labelFor(config: AssetTypeConfig | undefined, key: CoreLabelKey): string {
  return config?.labels?.[key] || CORE_LABELS[key];
}
