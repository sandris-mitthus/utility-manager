import { createElement, Fragment, type ReactNode } from "react";
import type { FaqItem } from "@/app/components/faq-accordion";
import { readingWindowHint } from "@/app/lib/utility/reading-window";
import type { PublicContactSettings } from "@/app/lib/utility/types";

export const READING_SUBMISSION_TEMPLATE = `Klienta kods: KLIENTA KODS
Aukstais ūdens: AUKSTA ŪDENS RĀDĪJUMI
Karstais ūdens: KARSTA ŪDENS RĀDĪJUMI
Kanalizācija: KANALIZĀCIJAS RĀDĪJUMI`;

function trimmed(value: string) {
  return value.trim();
}

function boldContact(value: string): ReactNode {
  return createElement("strong", { className: "font-semibold text-zinc-900" }, value);
}

function contactAnswer(before: string, contact: string, after: string): ReactNode {
  return createElement(Fragment, null, before, boldContact(contact), after);
}

export function buildFaqItems(settings: PublicContactSettings): FaqItem[] {
  const phoneNumber = trimmed(settings.phoneNumber);
  const smsNumber = trimmed(settings.smsNumber);
  const whatsappNumber = trimmed(settings.whatsappNumber);
  const email = trimmed(settings.email);
  const readingSubmissionTemplate =
    trimmed(settings.readingSubmissionTemplate) || READING_SUBMISSION_TEMPLATE;

  const items: FaqItem[] = [
    {
      id: "where-client-number",
      question: "Kur atrodams klienta kods?",
      answer: "Klienta kods parasti ir norādīts rēķinā.",
    },
    {
      id: "use-address",
      question: "Vai var meklēt pēc adreses?",
      answer: "Nē. Ievadiet klienta kodu tā, kā tas norādīts rēķinā, piemēram, 01012A.",
    },
    {
      id: "phone-call",
      question: "Uz kādu numuru jāzvana, lai iesniegtu rādījumus?",
      answer: phoneNumber
        ? contactAnswer(
            "Zvaniet uz ",
            phoneNumber,
            ". Operatori pieņems rādījumus pa tālruni.",
          )
        : "Tālruņa numurs vēl nav norādīts. Sazinieties ar administratoru.",
    },
    {
      id: "sms",
      question: "Uz kādu numuru varu sūtīt SMS, lai nodotu rādījumus?",
      answer: smsNumber
        ? contactAnswer(
            "Sūtiet SMS uz ",
            smsNumber,
            ". Ziņojumā norādiet klienta kodu un skaitītāju rādījumus. Zemāk ir teksts, ko varat nokopēt un aizpildīt.",
          )
        : "SMS numurs vēl nav norādīts. Sazinieties ar administratoru.",
      copyTemplate: smsNumber ? readingSubmissionTemplate : undefined,
      copyLabel: "Ieteicamais SMS teksts",
    },
    {
      id: "whatsapp",
      question: "Uz kādu numuru WhatsApp varu sūtīt rādījumus?",
      answer: whatsappNumber
        ? contactAnswer(
            "WhatsApp ziņas sūtiet uz ",
            whatsappNumber,
            ". Pievienojiet klienta kodu un skaitītāju rādījumus. Zemāk ir teksts, ko varat nokopēt un aizpildīt.",
          )
        : "WhatsApp numurs vēl nav norādīts. Sazinieties ar administratoru.",
      copyTemplate: whatsappNumber ? readingSubmissionTemplate : undefined,
      copyLabel: "Ieteicamais WhatsApp teksts",
    },
    {
      id: "email",
      question: "Uz kādu e-pastu jāsūta e-pasts, lai iesniegtu rādījumus?",
      answer: email
        ? contactAnswer(
            "Rādījumus var iesniegt e-pastā: ",
            email,
            ". Zemāk ir teksts, ko varat nokopēt un aizpildīt ar saviem rādījumiem.",
          )
        : "E-pasta adrese vēl nav norādīta. Sazinieties ar administratoru.",
      copyTemplate: email ? readingSubmissionTemplate : undefined,
      copyLabel: "Ieteicamais e-pasta teksts",
    },
    {
      id: "not-found",
      question: "Ko darīt, ja dati netiek atrasti?",
      answer:
        "Pārbaudiet pareizrakstību un vai nav lieku atstarpju. Ja meklēšana joprojām neizdodas, sazinieties ar klientu apkalpošanu.",
    },
  ];

  if (settings.readingWindowDays > 0) {
    items.unshift({
      id: "reading-window",
      question: "Kad var nodot rādījumus?",
      answer: readingWindowHint(settings.readingWindowDays),
    });
  }

  return items;
}
