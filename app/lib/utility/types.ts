export type MeterType = "hot_water" | "cold_water" | "sewage";

export type UtilityMeter = {
  id: string;
  number: string;
  type: MeterType;
  verificationDate: string;
  clientId: string;
  location: string;
  previousReading: number;
  baselineReading: number;
};

export type UtilityClient = {
  id: string;
  clientNumber: string;
  address: string;
  meterIds: string[];
};

export type UtilitySubmission = {
  clientId: string;
  month: string;
  submittedAt: string;
  readings: Record<string, number>;
  previousReadings?: Record<string, number>;
};

export type PublicContactSettings = {
  email: string;
  smsNumber: string;
  whatsappNumber: string;
  phoneNumber: string;
};

export type AdminContactSettings = PublicContactSettings & {
  imapHost: string;
  emailPasswordConfigured: boolean;
  emailInboxConfigured: boolean;
};

export type ContactSettingsUpdate = PublicContactSettings & {
  imapHost?: string;
  emailPassword?: string;
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
  hasSubmissionThisMonth: boolean;
  submissionToken: string;
};
