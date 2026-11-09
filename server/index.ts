import { createApp } from "./app.js";
import { getConfig } from "./config.js";
import { APP_VERSION } from "../shared/version.js";

const protocol = "sitefenn-launch-1";
let runtime: Awaited<ReturnType<typeof createApp>> | undefined;
let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  try {
    await runtime?.app.close();
  } finally {
    process.exit(code);
  }
}

if (process.send) process.once("disconnect", () => void shutdown());
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => void shutdown());

try {
  const config = getConfig();
  runtime = await createApp({ ...config, dev: process.argv.includes("--dev") });
  const origin = await runtime.app.listen({
    host: config.host,
    port: config.port,
  });
  if (process.connected)
    process.send?.({
      protocol,
      state: "ready",
      pid: process.pid,
      version: APP_VERSION,
      origin,
    });
  console.log(
    `SiteFenn ${APP_VERSION}\nLocal: ${origin}\nData: ${config.dataDir}\nOnly scan trusted websites you own or are authorized to test.`,
  );
  runtime.runner.enqueue();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Startup failed");
  const code = (error as NodeJS.ErrnoException)?.code;
  if (process.connected)
    await new Promise<void>((resolve) =>
      process.send!({ protocol, state: "failed", code }, () => resolve()),
    );
  await shutdown(1);
}
