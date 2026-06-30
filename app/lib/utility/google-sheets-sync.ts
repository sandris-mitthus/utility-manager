import { google } from "googleapis";
import type { createAdminClient } from "@/app/lib/supabase/admin";
import {
  calculateConsumption,
  formatReading,
  METER_TYPE_LABELS,
} from "@/app/lib/utility/helpers";
import type { UtilityClient, UtilityMeter } from "@/app/lib/utility/types";

const SHEET_TITLE = "Rādījumi";
const HEADER_ROW = [
  "Klienta ID",
  "Klienta Nr.",
  "Adrese",
  "Iesniegts",
  "Skaitītāji",
  "Rādījumi",
  "Iepriekšējie rādījumi",
  "Patēriņš",
] as const;

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

type GoogleSheetMonthRow = {
  month: string;
  spreadsheet_id: string;
  spreadsheet_url: string;
  sheet_title: string;
};

type GoogleServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

type GoogleOAuthCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

type GoogleClients = {
  sheets: ReturnType<typeof google.sheets>;
  drive: ReturnType<typeof google.drive>;
};

export type GoogleSheetSubmission = {
  month: string;
  submittedAt?: string;
  client: UtilityClient;
  meters: UtilityMeter[];
  readings: Record<string, number>;
  previousReadings: Record<string, number>;
};

export type GoogleSheetSyncResult = {
  spreadsheetId: string;
  spreadsheetUrl: string;
};

function getServiceAccountCredentials(): GoogleServiceAccountCredentials | null {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const parsed = JSON.parse(json) as Partial<GoogleServiceAccountCredentials>;
    if (parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key.replace(/\\n/g, "\n"),
      };
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim();
  if (!clientEmail || !privateKey) {
    return null;
  }

  return {
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, "\n"),
  };
}

function getOAuthCredentials(): GoogleOAuthCredentials | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return { clientId, clientSecret, refreshToken };
}

export function isGoogleSheetsSyncConfigured(): boolean {
  if (process.env.GOOGLE_SHEETS_ENABLED === "false") {
    return false;
  }

  return Boolean(getOAuthCredentials() || getServiceAccountCredentials());
}

function getGoogleClients(): GoogleClients | null {
  const oauthCredentials = getOAuthCredentials();
  if (oauthCredentials) {
    const auth = new google.auth.OAuth2(
      oauthCredentials.clientId,
      oauthCredentials.clientSecret,
    );
    auth.setCredentials({ refresh_token: oauthCredentials.refreshToken });

    return {
      sheets: google.sheets({ version: "v4", auth }),
      drive: google.drive({ version: "v3", auth }),
    };
  }

  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    return null;
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

function isGoogleStorageQuotaError(error: unknown): boolean {
  const candidate = error as {
    code?: number;
    response?: { data?: { error?: { errors?: Array<{ reason?: string }> } } };
  };

  return (
    candidate.code === 403 &&
    (candidate.response?.data?.error?.errors ?? []).some(
      (item) => item.reason === "storageQuotaExceeded",
    )
  );
}

function isGoogleInvalidGrantError(error: unknown): boolean {
  const candidate = error as {
    message?: string;
    response?: { data?: { error?: string; error_description?: string } };
  };

  return (
    candidate.response?.data?.error === "invalid_grant" ||
    candidate.message?.includes("invalid_grant") === true
  );
}

function normalizeGoogleSheetsError(error: unknown): Error {
  if (isGoogleInvalidGrantError(error)) {
    return new Error(
      "Google Sheets autorizācija ir beigusies. Administratoram jāatjauno Google OAuth refresh token Vercel iestatījumos.",
    );
  }

  return error instanceof Error ? error : new Error("Neizdevās atjaunot Google Sheet.");
}

function monthSheetTitle(month: string): string {
  return `Rādījumi ${month}`;
}

function sheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function formatSubmittedAt(value: string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function buildMultiLineCell(lines: string[]): string {
  return lines.filter(Boolean).join("\n");
}

function buildSubmissionRow(submission: GoogleSheetSubmission): string[] {
  const meters = [...submission.meters].sort((a, b) => a.number.localeCompare(b.number, "lv"));

  return [
    submission.client.id,
    submission.client.clientNumber,
    submission.client.address,
    formatSubmittedAt(submission.submittedAt),
    buildMultiLineCell(
      meters.map((meter) => `${meter.number} - ${METER_TYPE_LABELS[meter.type]}`),
    ),
    buildMultiLineCell(
      meters.map((meter) => {
        const reading = submission.readings[meter.id];
        return reading === undefined ? "" : `${meter.number}: ${formatReading(reading)}`;
      }),
    ),
    buildMultiLineCell(
      meters.map((meter) => {
        const previous = submission.previousReadings[meter.id];
        return previous === undefined ? "" : `${meter.number}: ${formatReading(previous)}`;
      }),
    ),
    buildMultiLineCell(
      meters.map((meter) => {
        const reading = submission.readings[meter.id];
        const previous = submission.previousReadings[meter.id];
        const consumption =
          reading === undefined || previous === undefined
            ? null
            : calculateConsumption(previous, reading);
        return consumption === null ? "" : `${meter.number}: ${formatReading(consumption)}`;
      }),
    ),
  ];
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createMonthSpreadsheet(month: string): Promise<GoogleSheetMonthRow> {
  const clients = getGoogleClients();
  if (!clients) {
    throw new Error("Google Sheets nav konfigurēts.");
  }

  try {
    const title = monthSheetTitle(month);
    const folderId = process.env.GOOGLE_SHEETS_FOLDER_ID?.trim();
    let spreadsheetId: string | null | undefined;
    let spreadsheetUrl: string | null | undefined;

    if (folderId) {
      const createResponse = await clients.drive.files.create({
        requestBody: {
          name: title,
          mimeType: "application/vnd.google-apps.spreadsheet",
          parents: [folderId],
        },
        fields: "id, webViewLink",
        supportsAllDrives: true,
      });
      spreadsheetId = createResponse.data.id;
      spreadsheetUrl = createResponse.data.webViewLink;

      if (spreadsheetId) {
        await clients.sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: { sheetId: 0, title: SHEET_TITLE },
                  fields: "title",
                },
              },
            ],
          },
        });
      }
    } else {
      const createResponse = await clients.sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title,
          },
          sheets: [
            {
              properties: {
                title: SHEET_TITLE,
              },
            },
          ],
        },
      });
      spreadsheetId = createResponse.data.spreadsheetId;
      spreadsheetUrl = createResponse.data.spreadsheetUrl;
    }

    if (!spreadsheetId) {
      throw new Error("Google Sheets neatgrieza faila ID.");
    }

    await clients.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheetName(SHEET_TITLE)}!A1:H1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[...HEADER_ROW]],
      },
    });

    return {
      month,
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: spreadsheetUrl ?? sheetUrl(spreadsheetId),
      sheet_title: SHEET_TITLE,
    };
  } catch (error) {
    if (isGoogleStorageQuotaError(error)) {
      throw new Error(
        "Google service account nevar izveidot Drive failu, jo tam nav Drive krātuves kvotas. Iestatiet GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET un GOOGLE_OAUTH_REFRESH_TOKEN, lai failus veidotu ar Google lietotāja kontu.",
      );
    }

    throw error;
  }
}

async function getOrCreateMonthSheet(
  supabase: SupabaseAdminClient,
  month: string,
): Promise<GoogleSheetMonthRow> {
  const { data: existing, error: existingError } = await supabase
    .from("google_sheet_months")
    .select("month, spreadsheet_id, spreadsheet_url, sheet_title")
    .eq("month", month)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing as GoogleSheetMonthRow;
  }

  const created = await createMonthSpreadsheet(month);
  const { data, error } = await supabase
    .from("google_sheet_months")
    .upsert(
      {
        month: created.month,
        spreadsheet_id: created.spreadsheet_id,
        spreadsheet_url: created.spreadsheet_url,
        sheet_title: created.sheet_title,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "month" },
    )
    .select("month, spreadsheet_id, spreadsheet_url, sheet_title")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Neizdevās saglabāt Google Sheet mēnesi.");
  }

  return data as GoogleSheetMonthRow;
}

async function findClientRowIndex(
  spreadsheetId: string,
  sheetTitle: string,
  clientId: string,
): Promise<number | null> {
  const clients = getGoogleClients();
  if (!clients) {
    throw new Error("Google Sheets nav konfigurēts.");
  }

  const response = await clients.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetName(sheetTitle)}!A:A`,
  });

  const rows = response.data.values ?? [];
  const index = rows.findIndex((row) => row[0] === clientId);
  return index === -1 ? null : index + 1;
}

export async function syncSubmissionToGoogleSheet(
  supabase: SupabaseAdminClient,
  submission: GoogleSheetSubmission,
): Promise<GoogleSheetSyncResult | null> {
  if (!isGoogleSheetsSyncConfigured()) {
    return null;
  }

  const clients = getGoogleClients();
  if (!clients) {
    return null;
  }

  const monthSheet = await getOrCreateMonthSheet(supabase, submission.month);
  const row = buildSubmissionRow(submission);
  const existingRowIndex = await findClientRowIndex(
    monthSheet.spreadsheet_id,
    monthSheet.sheet_title,
    submission.client.id,
  );

  if (existingRowIndex) {
    await clients.sheets.spreadsheets.values.update({
      spreadsheetId: monthSheet.spreadsheet_id,
      range: `${quoteSheetName(monthSheet.sheet_title)}!A${existingRowIndex}:H${existingRowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row],
      },
    });
    return {
      spreadsheetId: monthSheet.spreadsheet_id,
      spreadsheetUrl: monthSheet.spreadsheet_url,
    };
  }

  await clients.sheets.spreadsheets.values.append({
    spreadsheetId: monthSheet.spreadsheet_id,
    range: `${quoteSheetName(monthSheet.sheet_title)}!A:H`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  });

  return {
    spreadsheetId: monthSheet.spreadsheet_id,
    spreadsheetUrl: monthSheet.spreadsheet_url,
  };
}

export async function syncSubmissionToGoogleSheetRequired(
  supabase: SupabaseAdminClient,
  submission: GoogleSheetSubmission,
): Promise<GoogleSheetSyncResult> {
  try {
    const result = await syncSubmissionToGoogleSheet(supabase, submission);
    if (result) {
      return result;
    }
  } catch (error) {
    console.error("Google Sheets sync failed:", error);
    if (isGoogleInvalidGrantError(error)) {
      throw normalizeGoogleSheetsError(error);
    }
  }

  try {
    await wait(1_000);
    const result = await syncSubmissionToGoogleSheet(supabase, submission);
    if (result) {
      return result;
    }
  } catch (retryError) {
    console.error("Google Sheets sync retry failed:", retryError);
    throw normalizeGoogleSheetsError(retryError);
  }

  throw new Error("Google Sheets nav konfigurēts servera vidē.");
}

export async function syncSubmissionToGoogleSheetSafely(
  supabase: SupabaseAdminClient,
  submission: GoogleSheetSubmission,
): Promise<GoogleSheetSyncResult | null> {
  try {
    return await syncSubmissionToGoogleSheetRequired(supabase, submission);
  } catch (error) {
    console.error("Google Sheets sync failed after retry:", error);
    return null;
  }
}
