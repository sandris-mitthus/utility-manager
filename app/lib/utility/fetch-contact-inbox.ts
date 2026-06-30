import { simpleParser } from "mailparser";
import { ImapFlow } from "imapflow";
import { loadContactEmailCredentials } from "@/app/lib/utility/contact-settings-credentials";
import {
  insertEmailInboxMessage,
  loadEmailFetchState,
  summarizeRecentEmailFetch,
  updateEmailFetchState,
} from "@/app/lib/utility/email-inbox-repository";
import { getContactImapUser } from "@/app/lib/utility/imap-config";
import type { ContactEmailCredentials } from "@/app/lib/utility/contact-settings-credentials";
import type { EmailFetchSummary } from "@/app/lib/utility/types";

type RawImapMessage = {
  uid: number;
  source: Buffer;
};

const DEFAULT_UNREAD_FETCH_LIMIT = 25;

function formatImapError(error: unknown, credentials: ContactEmailCredentials): string {
  const base = error instanceof Error ? error.message : "Neizdevās ievākt e-pastus.";
  const host = credentials.imapHost ? `${credentials.imapHost}:${credentials.imapPort}` : "IMAP";

  if (/command failed/i.test(base)) {
    return `IMAP savienojums ar ${host} neizdevās (${base}). Pārbaudiet IMAP serveri, portu un paroli.`;
  }

  if (/auth|login|credentials|password/i.test(base)) {
    return `IMAP autentifikācija neizdevās (${host}). Pārbaudiet e-pastu un paroli.`;
  }

  return base;
}

async function parseMessageSource(source: Buffer) {
  const parsed = await simpleParser(source);
  const subject = parsed.subject?.trim() ?? "";
  const text = parsed.text?.trim() ?? "";
  const htmlText =
    typeof parsed.html === "string"
      ? parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : "";
  const bodyText = text || htmlText;
  const fromAddress = parsed.from?.value?.[0]?.address ?? "";
  const messageId = parsed.messageId ?? null;
  const receivedAt = parsed.date ? parsed.date.toISOString() : null;

  return {
    subject,
    bodyText,
    fromAddress,
    messageId,
    receivedAt,
  };
}

function createImapClient(credentials: ContactEmailCredentials): ImapFlow {
  return new ImapFlow({
    host: credentials.imapHost!,
    port: credentials.imapPort,
    secure: credentials.imapPort === 993,
    auth: {
      user: getContactImapUser(credentials.email),
      pass: credentials.password!,
    },
    logger: false,
  });
}

export async function fetchContactInboxEmails(): Promise<{
  summary: EmailFetchSummary;
  lastImapUid: number;
}> {
  const credentials = await loadContactEmailCredentials();
  if (!credentials.email || !credentials.password || !credentials.imapHost) {
    throw new Error(
      "E-pasta ievākšana nav konfigurēta. Admin iestatījumos norādiet e-pastu, paroli un IMAP serveri.",
    );
  }

  const startedAt = new Date().toISOString();
  const state = await loadEmailFetchState();
  const client = createImapClient(credentials);
  let lock: { release: () => void } | undefined;

  try {
    await client.connect();
    lock = await client.getMailboxLock("INBOX");

    const rawMessages: RawImapMessage[] = [];

    for await (const message of client.fetch({ seen: false }, { uid: true, source: true })) {
      if (!message.uid || !message.source) {
        continue;
      }

      rawMessages.push({ uid: message.uid, source: message.source });
      if (rawMessages.length >= DEFAULT_UNREAD_FETCH_LIMIT) {
        break;
      }
    }

    rawMessages.sort((left, right) => left.uid - right.uid);

    let maxUid = state.lastImapUid;
    let insertedCount = 0;
    const uidsToMarkSeen: number[] = [];

    for (const rawMessage of rawMessages) {
      const parsedMessage = await parseMessageSource(rawMessage.source);
      const result = await insertEmailInboxMessage({
        imapUid: rawMessage.uid,
        messageId: parsedMessage.messageId,
        fromAddress: parsedMessage.fromAddress,
        subject: parsedMessage.subject,
        bodyText: parsedMessage.bodyText,
        receivedAt: parsedMessage.receivedAt,
      });

      if (result.inserted) {
        insertedCount += 1;
      }

      uidsToMarkSeen.push(rawMessage.uid);

      if (rawMessage.uid > maxUid) {
        maxUid = rawMessage.uid;
      }
    }

    if (uidsToMarkSeen.length > 0) {
      await client.messageFlagsAdd(uidsToMarkSeen, ["\\Seen"], { uid: true });
    }

    await updateEmailFetchState({
      lastImapUid: maxUid,
      lastFetchAt: new Date().toISOString(),
      lastFetchStatus: insertedCount > 0 ? "ok" : "ok_no_new",
      lastError: "",
    });

    const summary = await summarizeRecentEmailFetch(startedAt);
    return {
      summary: {
        ...summary,
        fetchedCount: rawMessages.length,
        newCount: insertedCount,
      },
      lastImapUid: maxUid,
    };
  } catch (error) {
    const message = formatImapError(error, credentials);
    await updateEmailFetchState({
      lastFetchAt: new Date().toISOString(),
      lastFetchStatus: "error",
      lastError: message,
    });
    throw new Error(message);
  } finally {
    lock?.release();
    try {
      await client.logout();
    } catch {
      // savienojums jau var būt aizvērts
    }
  }
}

export async function getImapMailboxHint(): Promise<string> {
  const credentials = await loadContactEmailCredentials();
  if (!credentials.imapHost) {
    return "Nav konfigurēts";
  }
  return `${credentials.imapHost}:${credentials.imapPort}`;
}
