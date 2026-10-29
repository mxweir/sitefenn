import { createApp } from "./app.js";
import { getConfig } from "./config.js";
import { APP_VERSION } from "../shared/version.js";

const config = getConfig();
const { app, runner } = await createApp({
  ...config,
  dev: process.argv.includes("--dev"),
});
try {
  await app.listen({ host: config.host, port: config.port });
  console.log(
    `SiteFenn ${APP_VERSION}\nLocal: http://${config.host}:${config.port}\nData: ${config.dataDir}\nOnly scan trusted websites you own or are authorized to test.`,
  );
  runner.enqueue();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Startup failed");
  await app.close();
  process.exit(1);
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
