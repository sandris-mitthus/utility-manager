import { parseMeterEmail } from "../app/lib/utility/parse-meter-email.ts";
import { matchParsedReadingsToClientMeters } from "../app/lib/utility/match-parsed-email-readings.ts";

const clientId = "test-client";
const client = {
  id: clientId,
  clientNumber: "1234",
  address: "Test",
  meterIds: [],
};

const meters = [
  {
    id: "m-111",
    number: "A-1",
    type: "cold_water",
    verificationDate: "2024-01-01",
    clientId,
    location: "Virtuve",
    previousReading: 111,
    baselineReading: 111,
  },
  {
    id: "m-123",
    number: "B-2",
    type: "hot_water",
    verificationDate: "2024-01-01",
    clientId,
    location: "Virtuve",
    previousReading: 123,
    baselineReading: 123,
  },
];

const parsed = parseMeterEmail("", "1234=155-123");
const matched = matchParsedReadingsToClientMeters(parsed, client, meters);

console.log("--- 1234=155-123, baselines 111 un 123 ---");
for (const item of matched) {
  console.log(
    `  rādījums ${item.source.currentValue} -> baseline ${item.baselineReading} (${item.matchMethod})`,
  );
}

const byValue = new Map(matched.map((item) => [item.source.currentValue, item.baselineReading]));
const ok = byValue.get(123) === 111 && byValue.get(155) === 123;

if (!ok) {
  console.log("FAIL: expected 123->111 and 155->123");
  process.exitCode = 1;
} else {
  console.log("OK");
}
