/**
 * Tipiski rādījumu iesniegšanas formāti (Limbažu projekta apraksts).
 * Izmanto testiem un parsētāja uzturēšanai.
 */
export const LIMBAZI_EMAIL_SAMPLES: Array<{ subject: string; body: string; note: string }> = [
  {
    subject: "",
    body: "6864 (klienta Nr.)= 802,375-808,641",
    note: "Klienta nr. iekavās + diapazons",
  },
  {
    subject: "",
    body: "Irbes iela 8, Limbazos- 502,170",
    note: "Adrese + rādījums aiz defises",
  },
  {
    subject: "",
    body: "Klienta nr. 9570 , Birztalas-10, Puikule, Brivzemnieku pagasts , Radijums - 481.05",
    note: "Klienta nr. + adrese + Radijums",
  },
  {
    subject: "",
    body: "Skolas iela 6-3,Aloja kl.nr.8966 0.26-0.26",
    note: "kl.nr. bez atstarpes + diapazons",
  },
  {
    subject: "",
    body: "Klients 2308. Aukst.ud.- 412.166; karstais- 567.428",
    note: "Semikoli + saīsinājumi",
  },
  {
    subject: "Klienta Nr. 4517",
    body: "",
    note: "Tikai tēmā",
  },
  {
    subject: "",
    body: 'Klienta Nr. 8508 "Selgas"-9, Vidrizi, skaititaju radijumi uz 30.11.2025: Aukstais udens virtuve 00102 m3, Karstais udens virtuve 00079 m3, Aukstais udens vanna 00553 m3, Karstais udens vanna 00919 m3',
    note: "m3 ar vietu",
  },
  {
    subject: "",
    body: "Labdien. Laukunoela 7- 15 klienta nr. 1159 Siltais - 00289,482 Aukstais - 0780,569",
    note: "Brīvteksts ar vairākiem rādījumiem",
  },
  {
    subject: "",
    body: "Klienta numurs: 1234\nAukstais ūdens: 125\nKanalizācija: 125",
    note: "Rindiņas ar kolu",
  },
  {
    subject: "",
    body: "Maja2 8ZR10017777090 22.90 23.20\nMaja1 8ZR10017770976 131.00 135.90",
    note: "Tabula ar vietas nosaukumu",
  },
  {
    subject: "",
    body: "1234=156-123",
    note: "Klienta nr. = divi skaitītāju rādījumi",
  },
];
