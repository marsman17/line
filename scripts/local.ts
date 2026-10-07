import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { prepareLocal } from "./dev-setup.ts";
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--port"))
  throw new Error("Usage: npm run local -- --port 3005");
const port = args.length ? Number(args[1]) : 3000;
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Choose a port between 1024 and 65535.");
prepareLocal();
const require = createRequire(import.meta.url);
const environment: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "development",
  ...(args.length ? { APP_URL: `http://localhost:${port}` } : {}),
};
const processes = [
  spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "dev",
      "--hostname",
      "0.0.0.0",
      "--port",
      String(port),
    ],
    { stdio: "inherit", env: environment },
  ),
  spawn(process.execPath, ["--import", "tsx", "scripts/worker.ts"], {
    stdio: "inherit",
    env: environment,
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of processes)
    if (child.exitCode === null) child.kill("SIGTERM");
  const timer = setTimeout(() => {
    for (const child of processes)
      if (child.exitCode === null) child.kill("SIGKILL");
  }, 5000);
  timer.unref();
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
for (const child of processes) {
  child.on("error", () => {
    console.error(
      "A local service could not start. Check Node.js and installed dependencies.",
    );
    stop(1);
  });
  child.on("exit", (code, signal) => {
    if (!stopping) stop(signal ? 1 : (code ?? 1));
  });
}
console.log(
  "TableQ local mode: web app and notification worker. Press Ctrl+C to stop both.",
);
