import { parseMeterEmail } from "../app/lib/utility/parse-meter-email.ts";
import { LIMBAZI_EMAIL_SAMPLES } from "../app/lib/utility/limbazi-email-samples.ts";

let failed = 0;

for (const sample of LIMBAZI_EMAIL_SAMPLES) {
  const result = parseMeterEmail(sample.subject, sample.body);
  console.log("---");
  console.log(sample.note);
  console.log(
    "client:",
    result.clientNumber ?? "(nav)",
    "| address:",
    result.addressHint ?? "(nav)",
    "| confidence:",
    result.confidence,
    "| v:",
    result.parseVersion,
  );
  console.log(
    "readings:",
    result.readings.length
      ? result.readings
          .map((item) => {
            const label = item.label ?? item.meterNumber ?? "?";
            const range =
              item.previousValue !== undefined
                ? `${item.previousValue}->${item.currentValue}`
                : String(item.currentValue);
            return `${label}:${range}`;
          })
          .join(", ")
      : "(nav)",
  );
  console.log("warnings:", result.warnings.join("; ") || "(none)");

  if (sample.note.includes("tikai tēmā") && !result.clientNumber) {
    failed += 1;
    console.log("FAIL: expected client from subject");
  }
  if (sample.note.includes("Semikoli") && result.readings.length < 2) {
    failed += 1;
    console.log("FAIL: expected 2 readings");
  }
  if (sample.note.includes("m3 ar vietu") && result.readings.length < 2) {
    failed += 1;
    console.log("FAIL: expected m3 readings");
  }
  if (sample.note.includes("divi skaitītāju") && result.readings.length !== 2) {
    failed += 1;
    console.log("FAIL: expected 2 split readings");
  }
  if (sample.note.includes("divi skaitītāju") && result.clientNumber !== "1234") {
    failed += 1;
    console.log("FAIL: expected client 1234");
  }
}

if (failed > 0) {
  process.exitCode = 1;
  console.log(`\n${failed} assertion(s) failed`);
}
