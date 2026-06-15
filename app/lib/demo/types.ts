export type MeterType = "hot_water" | "cold_water" | "sewage";

export type DemoMeter = {
  id: string;
  number: string;
  type: MeterType;
  verificationDate: string;
  clientId: string;
  location: string;
  previousReading: number;
};

export type DemoClient = {
  id: string;
  clientNumber: string;
  address: string;
  meterIds: string[];
};

export type DemoSubmission = {
  clientId: string;
  month: string;
  submittedAt: string;
  readings: Record<string, number>;
};

export type DemoContactSettings = {
  email: string;
  emailPassword: string;
  smsNumber: string;
  whatsappNumber: string;
  phoneNumber: string;
};

export type DemoDataState = {
  clients: DemoClient[];
  meters: DemoMeter[];
  submissions: DemoSubmission[];
  settings: DemoContactSettings;
};
