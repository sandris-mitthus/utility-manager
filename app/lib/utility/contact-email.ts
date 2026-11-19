import { isContactEmailTransportConfigured } from "@/app/lib/utility/email-password";
import { formatReading } from "@/app/lib/utility/helpers";
import { getResendCredentials } from "@/app/lib/utility/integrations";
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

function notificationText(input: SubmissionNotificationInput): { subject: string; text: string } {
  const lines = Object.values(input.readings).map(
    (item) => `${item.meterNumber}: ${formatReading(item.value)}`,
  );
  return {
    subject: `Rādījumi iesniegti — ${input.clientNumber} (${input.month})`,
    text: [
      `Klienta kods: ${input.clientNumber}`,
      `Adrese: ${input.address}`,
      `Mēnesis: ${input.month}`,
      "",
      ...lines,
    ].join("\n"),
  };
}

async function sendWithResend(
  input: SubmissionNotificationInput,
  credentials: { fromEmail: string; apiKey: string; replyToEmail: string },
): Promise<void> {
  const message = notificationText(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: credentials.fromEmail,
      to: input.to,
      ...(credentials.replyToEmail ? { reply_to: credentials.replyToEmail } : {}),
      subject: message.subject,
      text: message.text,
    }),
  });

  if (!response.ok) {
    throw new Error("Resend neizdevās nosūtīt e-pastu.");
  }
}

export async function sendSubmissionNotificationEmail(
  input: SubmissionNotificationInput,
): Promise<void> {
  const resend = await getResendCredentials().catch(() => null);
  if (resend) {
    await sendWithResend(input, resend);
    return;
  }

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

  const message = notificationText(input);
  await transport.sendMail({
    from: getSmtpUser(input.to),
    to: input.to,
    subject: message.subject,
    text: message.text,
  });
}
