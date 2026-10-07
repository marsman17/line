import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
else if (existsSync(".env")) process.loadEnvFile(".env");
const { deliverNotifications } = await import("../lib/notifications.ts");
console.log("TableQ notification worker started.");
await deliverNotifications();
setInterval(() => {
  deliverNotifications().catch(() =>
    console.error("Notification worker failed; retrying next cycle."),
  );
}, 15000);
