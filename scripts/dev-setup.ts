import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import webpush from "web-push";
export function prepareLocal(directory = process.cwd()) {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error("Install Node.js 24 before running TableQ.");
  const destination = resolve(directory, ".env.local");
  if (existsSync(destination)) {
    console.log(
      "Existing .env.local preserved. No settings or data were changed.",
    );
    return;
  }
  const keys = webpush.generateVAPIDKeys();
  writeFileSync(
    destination,
    [
      "# Local development only. Do not use this configuration in production.",
      "APP_URL=http://localhost:3000",
      "DATABASE_PATH=./data/tableq.sqlite",
      "RESTAURANT_NAME=The Olive Table",
      "RESTAURANT_ADDRESS=24 Garden Avenue",
      "RESTAURANT_CAPACITY=50",
      `VAPID_PUBLIC_KEY=${keys.publicKey}`,
      `VAPID_PRIVATE_KEY=${keys.privateKey}`,
      "VAPID_SUBJECT=mailto:admin@tableq.local",
      "TRUST_PROXY=false",
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created local configuration and browser notification keys. Keys are not logged.",
  );
}
