import { z } from "zod";
import { optStr, reqStr } from "./schemas";
import { COLOR_OPTIONS } from "@/components/ui/badge";

/** Schemas for administration actions (kept out of the "use server" module). */
export const roleEnum = z.enum(["ADMIN", "INVENTORY_OFFICER", "OPERATIONS_USER", "VIEWER"]);

export const extraField = z.object({
  key: z.string().trim().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Key: letters/numbers only"),
  label: z.string().trim().min(1),
  type: z.enum(["text", "number", "select", "date", "boolean"]),
  options: z.array(z.string()).optional(),
});

export const saveUserSchema = z.object({
    id: optStr(50),
    name: reqStr("Name", 120),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    username: optStr(60).transform((v) => (v ? v.toLowerCase() : null)),
    role: roleEnum,
    active: z.boolean(),
    password: optStr(200),
  });

export const saveLocationSchema = z.object({ id: optStr(50), name: reqStr("Name", 80), description: optStr(300), aliases: z.array(z.string().trim().min(1)).default([]), active: z.boolean() });

export const saveAssetTypeSchema = z.object({
    id: optStr(50),
    name: reqStr("Name", 60),
    prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,10}$/, "Prefix: 1–10 letters/digits"),
    description: optStr(300),
    active: z.boolean(),
    config: z.object({
      identifier: z.enum(["imei", "serial"]).optional(),
      hasSim: z.boolean().optional(),
      hasOs: z.boolean().optional(),
      uniqueName: z.boolean().optional(),
      labels: z.record(z.string(), z.string()).optional(),
      extraFields: z.array(extraField).optional(),
    }),
  });

export const saveStatusSchema = z.object({ id: optStr(50), name: reqStr("Name", 40), color: z.string().refine((c) => COLOR_OPTIONS.includes(c), "Invalid colour"), active: z.boolean() });

export const saveSettingsSchema = z.object({
    organizationName: reqStr("Organisation name", 120),
    systemName: reqStr("System name", 80),
    logo: z.string().max(400_000, "Logo must be under 300 KB").nullable().optional(),
    verificationIntervalDays: z.coerce.number().int().min(1, "At least 1 day").max(3650),
    dueSoonDays: z.coerce.number().int().min(0).max(365),
    recalculate: z.boolean().default(true),
  });
