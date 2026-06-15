export type AppSettings = {
  appName: string;
  loadedFromDb: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  appName: "Utility Manager",
  loadedFromDb: false,
};
