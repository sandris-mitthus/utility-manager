export type MeterType = "hot_water" | "cold_water" | "sewage";

export type UtilityMeter = {
  id: string;
  number: string;
  type: MeterType;
  verificationDate: string;
  clientId: string;
  location: string;
  previousReading: number;
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
};

export type PublicContactSettings = {
  email: string;
  smsNumber: string;
  whatsappNumber: string;
  phoneNumber: string;
};

export type AdminContactSettings = PublicContactSettings & {
  emailPasswordConfigured: boolean;
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
