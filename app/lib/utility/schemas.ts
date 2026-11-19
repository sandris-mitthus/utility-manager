import { z } from "zod";

const meterTypeSchema = z.enum(["hot_water", "cold_water", "sewage", "heating"]);
const optionalIsoDateSchema = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.literal(""),
]);

export const whatsappModeSchema = z.enum(["off", "link", "api"]);

export const contactSettingsSchema = z
  .object({
    email: z.string().trim().email().max(320).optional(),
    smsNumber: z.string().trim().max(40).optional(),
    whatsappNumber: z.string().trim().max(40).optional(),
    phoneNumber: z.string().trim().max(40).optional(),
    readingSubmissionTemplate: z.string().trim().max(2000).optional(),
    readingWindowDays: z.number().int().min(0).max(31).optional(),
    imapHost: z.string().trim().max(255).optional(),
    emailPassword: z.string().max(200).optional(),
    whatsappMode: whatsappModeSchema.optional(),
    whatsappMessageTemplate: z.string().trim().max(2000).optional(),
    whatsappPhoneNumberId: z.string().trim().max(60).optional(),
    whatsappNotifyNumber: z.string().trim().max(40).optional(),
    whatsappTemplateName: z.string().trim().max(120).optional(),
    whatsappTemplateLanguage: z.string().trim().max(10).optional(),
    whatsappAccessToken: z.string().max(500).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Nav ko saglabāt.",
  });

export const whatsappTestMessageSchema = z.object({
  to: z.string().trim().max(40).optional(),
});

export const utilityClientSchema = z.object({
  id: z.string().uuid(),
  clientNumber: z.string().trim().min(1).max(80),
  name: z.string().trim().max(300).default(""),
  address: z.string().trim().min(1).max(1000),
  email: z.string().trim().max(320).default(""),
  phone: z.string().trim().max(80).default(""),
  phoneExtra: z.string().trim().max(80).default(""),
  extraCode: z.string().trim().max(80).default(""),
  meterIds: z.array(z.string().uuid()),
  publicToken: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.string().uuid().optional(),
  ),
});

export const utilityMeterSchema = z
  .object({
    id: z.string().uuid(),
    number: z.string().trim().min(1).max(80),
    type: meterTypeSchema,
    typeCode: z.string().trim().max(40).default(""),
    verificationDate: optionalIsoDateSchema.default(""),
    validUntil: optionalIsoDateSchema.default(""),
    clientId: z.string().uuid().or(z.literal("")),
    location: z.string().trim().max(200).default(""),
    address: z.string().trim().max(1000).default(""),
    previousReading: z.number().min(0),
    baselineReading: z.number().min(0).optional(),
    readingRegisteredOn: optionalIsoDateSchema.default(""),
    readingPeriodEnd: optionalIsoDateSchema.default(""),
    readingRecordNumber: z.string().trim().max(40).default(""),
  })
  .transform((meter) => ({
    ...meter,
    baselineReading: meter.baselineReading ?? meter.previousReading,
    validUntil: meter.validUntil || meter.verificationDate,
  }));

export const syncClientMetersSchema = z.object({
  meterIds: z.array(z.string().uuid()),
});

export const googleSheetMonthSyncSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export const attachMeterClientSchema = z.object({
  clientId: z.string().uuid().nullable(),
});

export const publicLookupQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
});

export const publicLookupTokenQuerySchema = z.object({
  token: z.string().trim().uuid(),
});

export const publicSubmissionSchema = z.object({
  clientId: z.string().uuid(),
  submissionToken: z.string().min(1).max(500),
  readings: z.record(z.string().uuid(), z.number().min(0)),
});

export const deleteIdQuerySchema = z.object({
  id: z.string().uuid(),
});
