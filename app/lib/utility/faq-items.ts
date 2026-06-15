import type { FaqItem } from "@/app/components/faq-accordion";
import type { PublicContactSettings } from "@/app/lib/utility/types";

export const READING_SUBMISSION_TEMPLATE = `Klienta numurs: KLIENTA NUMURS
Aukstais ūdens: AUKSTA ŪDENS RĀDĪJUMI
Karstais ūdens: KARSTA ŪDENS RĀDĪJUMI
Kanalizācija: KANALIZĀCIJAS RĀDĪJUMI`;

function trimmed(value: string) {
  return value.trim();
}

export function buildFaqItems(settings: PublicContactSettings): FaqItem[] {
  const phoneNumber = trimmed(settings.phoneNumber);
  const smsNumber = trimmed(settings.smsNumber);
  const whatsappNumber = trimmed(settings.whatsappNumber);
  const email = trimmed(settings.email);

  return [
    {
      id: "where-client-number",
      question: "Kur atrodams klienta numurs?",
      answer: "Klienta numurs parasti ir norādīts rēķinā.",
    },
    {
      id: "use-address",
      question: "Vai var meklēt pēc adreses?",
      answer:
        "Jā. Ievadiet objekta adresi tā, kā tā norādīta rēķinā vai līgumā, piemēram, ielas nosaukumu, mājas numuru un pilsētu.",
    },
    {
      id: "phone-call",
      question: "Uz kādu numuru jāzvana, lai iesniegtu rādījumus?",
      answer: phoneNumber
        ? `Zvaniet uz ${phoneNumber}. Operatori pieņems rādījumus pa tālruni.`
        : "Tālruņa numurs vēl nav norādīts. Sazinieties ar administratoru.",
    },
    {
      id: "sms",
      question: "Uz kādu numuru varu sūtīt SMS, lai nodotu rādījumus?",
      answer: smsNumber
        ? `Sūtiet SMS uz ${smsNumber}. Ziņojumā norādiet klienta numuru un skaitītāju rādījumus. Zemāk ir teksts, ko varat nokopēt un aizpildīt.`
        : "SMS numurs vēl nav norādīts. Sazinieties ar administratoru.",
      copyTemplate: smsNumber ? READING_SUBMISSION_TEMPLATE : undefined,
      copyLabel: "Ieteicamais SMS teksts",
    },
    {
      id: "whatsapp",
      question: "Uz kādu numuru WhatsApp varu sūtīt rādījumus?",
      answer: whatsappNumber
        ? `WhatsApp ziņas sūtiet uz ${whatsappNumber}. Pievienojiet klienta numuru un skaitītāju rādījumus. Zemāk ir teksts, ko varat nokopēt un aizpildīt.`
        : "WhatsApp numurs vēl nav norādīts. Sazinieties ar administratoru.",
      copyTemplate: whatsappNumber ? READING_SUBMISSION_TEMPLATE : undefined,
      copyLabel: "Ieteicamais WhatsApp teksts",
    },
    {
      id: "email",
      question: "Uz kādu e-pastu jāsūta e-pasts, lai iesniegtu rādījumus?",
      answer: email
        ? `Rādījumus var iesniegt e-pastā: ${email}. Zemāk ir teksts, ko varat nokopēt un aizpildīt ar saviem rādījumiem.`
        : "E-pasta adrese vēl nav norādīta. Sazinieties ar administratoru.",
      copyTemplate: email ? READING_SUBMISSION_TEMPLATE : undefined,
      copyLabel: "Ieteicamais e-pasta teksts",
    },
    {
      id: "not-found",
      question: "Ko darīt, ja dati netiek atrasti?",
      answer:
        "Pārbaudiet pareizrakstību un vai nav lieku atstarpju. Ja meklēšana joprojām neizdodas, sazinieties ar klientu apkalpošanu.",
    },
  ];
}
