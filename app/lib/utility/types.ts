export type MeterType = "hot_water" | "cold_water" | "sewage" | "heating";

export type UtilityMeter = {
  id: string;
  number: string;
  type: MeterType;
  /** Eksporta tips, piemēram AU01 vai KU01. */
  typeCode: string;
  verificationDate: string;
  /** Derīguma termiņš (YYYY-MM-DD) vai tukša virkne. */
  validUntil: string;
  clientId: string;
  location: string;
  /** Objekta adrese, ja klientam ir vairākas adreses. */
  address: string;
  previousReading: number;
  baselineReading: number;
  readingRegisteredOn: string;
  readingPeriodEnd: string;
  readingRecordNumber: string;
};

export type UtilityClient = {
  id: string;
  clientNumber: string;
  name: string;
  address: string;
  email: string;
  /** Optional WhatsApp / phone for inbound sender verification. Empty = skip phone check. */
  phone: string;
  phoneExtra: string;
  /** CUVc 146. lauks. */
  extraCode: string;
  meterIds: string[];
  publicToken: string;
};

export type UtilitySubmission = {
  clientId: string;
  month: string;
  submittedAt: string;
  readings: Record<string, number>;
  previousReadings?: Record<string, number>;
};

/** `off` — kanāls izslēgts, `link` — wa.me saite, `api` — WhatsApp Business Cloud API. */
export type WhatsappMode = "off" | "link" | "api";

export type PublicContactSettings = {
  email: string;
  smsNumber: string;
  whatsappNumber: string;
  phoneNumber: string;
  readingSubmissionTemplate: string;
  /** 0 = visu mēnesi. Citādi tikai pēdējās tik dienas. */
  readingWindowDays: number;
  whatsappMode: WhatsappMode;
  whatsappMessageTemplate: string;
};

export type AdminContactSettings = PublicContactSettings & {
  imapHost: string;
  emailPasswordConfigured: boolean;
  emailInboxConfigured: boolean;
  whatsappPhoneNumberId: string;
  whatsappNotifyNumber: string;
  whatsappTemplateName: string;
  whatsappTemplateLanguage: string;
  whatsappAccessTokenConfigured: boolean;
  whatsappApiConfigured: boolean;
};

export type ContactSettingsUpdate = Partial<PublicContactSettings> & {
  imapHost?: string;
  emailPassword?: string;
  whatsappPhoneNumberId?: string;
  whatsappNotifyNumber?: string;
  whatsappTemplateName?: string;
  whatsappTemplateLanguage?: string;
  whatsappAccessToken?: string;
};

export type ParsedEmailReading = {
  label?: string;
  meterNumber?: string;
  previousValue?: number;
  currentValue: number;
};

export type ParsedMeterEmail = {
  clientNumber?: string;
  addressHint?: string;
  readings: ParsedEmailReading[];
  warnings: string[];
  confidence: "high" | "medium" | "low";
  /** Parsētāja versija — vecie ieraksti tiek pārparsēti, ja mazāka par pašreizējo. */
  parseVersion?: number;
};

export type EmailInboxMessage = {
  id: string;
  imapUid: number;
  messageId: string | null;
  fromAddress: string;
  subject: string;
  bodyText: string;
  receivedAt: string | null;
  parsed: ParsedMeterEmail;
  parseStatus: "pending" | "parsed" | "partial" | "failed";
  fetchedAt: string;
  submissionImportedAt: string | null;
  submissionMonth: string | null;
  submissionClientId: string | null;
  submissionImportError: string;
};

export type EmailFetchState = {
  lastImapUid: number;
  lastFetchAt: string | null;
  lastFetchStatus: string;
  lastError: string;
};

export type EmailFetchSummary = {
  fetchedCount: number;
  newCount: number;
  parseStatusCounts: Record<string, number>;
};

export type WhatsappInboxMessage = {
  id: string;
  waMessageId: string;
  fromWaId: string;
  fromProfileName: string;
  bodyText: string;
  receivedAt: string | null;
  parsed: ParsedMeterEmail;
  parseStatus: "pending" | "parsed" | "partial" | "failed";
  fetchedAt: string;
  submissionImportedAt: string | null;
  submissionMonth: string | null;
  submissionClientId: string | null;
  submissionImportError: string;
};

export type UtilityState = {
  clients: UtilityClient[];
  meters: UtilityMeter[];
  submissions: UtilitySubmission[];
  settings: AdminContactSettings;
};

export type PublicPageSettings = {
  settings: PublicContactSettings;
};

export type PublicLookupResult = {
  client: UtilityClient;
  meters: UtilityMeter[];
  /** True only when every current meter already has a reading this month. */
  hasSubmissionThisMonth: boolean;
  /** Readings already stored this month. The public form locks these meters. */
  submittedReadings: Record<string, number>;
  /** Baseline saved with those readings, before the meter was updated. */
  submittedPreviousReadings: Record<string, number>;
  submissionToken: string;
};
