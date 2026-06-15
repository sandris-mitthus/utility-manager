import type { FaqItem } from "@/app/components/faq-accordion";
import type { DemoContactSettings } from "@/app/lib/demo/types";

export const EMAIL_READING_TEMPLATE = `Klienta numurs: KLIENTA NUMURS
Aukstais ūdens: AUKSTA ŪDENS RĀDĪJUMI
Karstais ūdens: KARSTA ŪDENS RĀDĪJUMI
Kanalizācija: KANALIZĀCIJAS RĀDĪJUMI`;

export function buildFaqItems(settings: DemoContactSettings): FaqItem[] {
  return [
    {
      id: "where-client-number",
      question: "Kur atrodams klienta numurs?",
      answer:
        "Klienta numurs parasti ir norādīts rēķinā augšējā labajā stūrī vai klientu portāla profilā. Tas var sākties ar burtiem, piemēram, K-.",
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
      answer: `Zvaniet uz ${settings.phoneNumber}. Darba laikā operatori pieņems rādījumus pa tālruni.`,
    },
    {
      id: "sms",
      question: "Uz kādu numuru varu sūtīt SMS, lai nodotu rādījumus?",
      answer: `Sūtiet SMS uz ${settings.smsNumber}. Ziņojumā norādiet klienta numuru un skaitītāju rādījumus.`,
    },
    {
      id: "whatsapp",
      question: "Uz kādu numuru WhatsApp varu sūtīt rādījumus?",
      answer: `WhatsApp ziņas sūtiet uz ${settings.whatsappNumber}. Pievienojiet klienta numuru un skaitītāju rādījumus.`,
    },
    {
      id: "email",
      question: "Uz kādu e-pastu jāsūta e-pasts, lai iesniegtu rādījumus?",
      answer: `Rādījumus var iesniegt e-pastā: ${settings.email}. Zemāk ir teksts, ko varat nokopēt un aizpildīt ar saviem rādījumiem.`,
      copyTemplate: EMAIL_READING_TEMPLATE,
    },
    {
      id: "not-found",
      question: "Ko darīt, ja dati netiek atrasti?",
      answer:
        "Pārbaudiet pareizrakstību un vai nav lieku atstarpju. Ja meklēšana joprojām neizdodas, sazinieties ar klientu apkalpošanu.",
    },
  ];
}
