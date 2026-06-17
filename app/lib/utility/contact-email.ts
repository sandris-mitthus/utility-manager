import { isContactEmailTransportConfigured } from "@/app/lib/utility/email-password";
import { loadContactEmailCredentials } from "@/app/lib/utility/contact-settings-credentials";

type SubmissionNotificationInput = {
  to: string;
  clientNumber: string;
  address: string;
  month: string;
  readings: Record<string, { meterNumber: string; value: number }>;
};

function getSmtpPort(): number {
  const raw = process.env.CONTACT_SMTP_PORT?.trim();
  const parsed = raw ? Number(raw) : 587;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 587;
}

function getSmtpUser(fallbackEmail: string): string {
  return process.env.CONTACT_SMTP_USER?.trim() || fallbackEmail;
}

export { isContactEmailTransportConfigured };

export async function sendSubmissionNotificationEmail(
  input: SubmissionNotificationInput,
): Promise<void> {
  const host = process.env.CONTACT_SMTP_HOST?.trim();
  if (!host) {
    return;
  }

  let password = process.env.CONTACT_EMAIL_PASSWORD?.trim() || "";
  if (!password) {
    try {
      const credentials = await loadContactEmailCredentials();
      password = credentials.password ?? "";
    } catch {
      return;
    }
  }

  if (!password) {
    return;
  }

  const { createTransport } = await import("nodemailer");
  const transport = createTransport({
    host,
    port: getSmtpPort(),
    secure: getSmtpPort() === 465,
    auth: {
      user: getSmtpUser(input.to),
      pass: password,
    },
  });

  const lines = Object.values(input.readings).map(
    (item) => `${item.meterNumber}: ${item.value}`,
  );

  await transport.sendMail({
    from: getSmtpUser(input.to),
    to: input.to,
    subject: `Rādījumi iesniegti — ${input.clientNumber} (${input.month})`,
    text: [
      `Klienta numurs: ${input.clientNumber}`,
      `Adrese: ${input.address}`,
      `Mēnesis: ${input.month}`,
      "",
      ...lines,
    ].join("\n"),
  });
}
