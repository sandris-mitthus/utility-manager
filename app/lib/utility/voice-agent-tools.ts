export const VOICE_AGENT_INTEGRATION_KEY = "voice_agent";

export const VOICE_AGENT_PATH = "/api/agent";

export const VOICE_AGENT_TOOLSET = {
  instructions: [
    "Zvanītājs grib nodot skaitītāju rādījumus.",
    "Vispirms vienmēr pajautā klienta numuru un izsauc find_client. Bez atrasta klienta rādījumus nepieņem.",
    "Ja klients nav atrasts, palūdz numuru pateikt vēlreiz pa cipariem.",
    "Pēc tam pa vienam pajautā katra vēl neiesniegtā skaitītāja rādījumu, nosaucot tā veidu un vietu.",
    "Rādījumu atkārto klientam un tikai pēc apstiprinājuma izsauc submit_reading.",
    "Ja rādījums nav pieņemts, pasaki iemeslu no rezultāta.",
  ].join(" "),
  tools: [
    {
      name: "find_client",
      description: "Atrod klientu pēc klienta numura un atgriež viņa skaitītājus.",
      params: { client_number: "klienta numurs" },
    },
    {
      name: "submit_reading",
      description: "Saglabā viena skaitītāja rādījumu šim mēnesim.",
      params: {
        client_number: "klienta numurs",
        meter: "skaitītāja numurs no find_client",
        reading: "rādījums skaitlī",
      },
      confirm: true,
    },
  ],
};
