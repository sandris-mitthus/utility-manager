import { z } from "zod";

const meterTypeSchema = z.enum(["hot_water", "cold_water", "sewage"]);

export const contactSettingsSchema = z.object({
  email: z.string().trim().email().max(320),
  smsNumber: z.string().trim().max(40),
  whatsappNumber: z.string().trim().max(40),
  phoneNumber: z.string().trim().max(40),
});

export const utilityClientSchema = z.object({
  id: z.string().uuid(),
  clientNumber: z.string().trim().min(1).max(80),
  address: z.string().trim().min(1).max(500),
  meterIds: z.array(z.string().uuid()),
});

export const utilityMeterSchema = z.object({
  id: z.string().uuid(),
  number: z.string().trim().min(1).max(80),
  type: meterTypeSchema,
  verificationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientId: z.string().uuid().or(z.literal("")),
  location: z.string().trim().max(200),
  previousReading: z.number().min(0),
});

export const syncClientMetersSchema = z.object({
  meterIds: z.array(z.string().uuid()),
});

export const attachMeterClientSchema = z.object({
  clientId: z.string().uuid().nullable(),
});

export const publicLookupQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
});

export const publicSubmissionSchema = z.object({
  clientId: z.string().uuid(),
  submissionToken: z.string().min(1).max(500),
  readings: z.record(z.string().uuid(), z.number().min(0)),
});

export const deleteIdQuerySchema = z.object({
  id: z.string().uuid(),
});
