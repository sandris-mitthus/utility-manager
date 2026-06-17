import { fetchContactInboxEmails } from "@/app/lib/utility/fetch-contact-inbox";
import { runEmailInboxImportPipeline } from "@/app/lib/utility/import-email-inbox-submissions";

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ success: false, message: "Neautorizēts." }, { status: 401 });
  }

  try {
    const result = await fetchContactInboxEmails();
    const importSummary = await runEmailInboxImportPipeline(50);
    return Response.json({
      success: true,
      data: {
        ...result,
        importSummary,
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Neizdevās ievākt e-pastus.",
      },
      { status: 500 },
    );
  }
}
