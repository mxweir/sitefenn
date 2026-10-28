import { createApp } from './app.js';
import { getConfig } from './config.js';

const config = getConfig();
const { app } = await createApp({ ...config, dev: process.argv.includes('--dev') });
try {
  await app.listen({ host: config.host, port: config.port });
  console.log(`Website Audit Hub 0.1.0\nLocal: http://${config.host}:${config.port}\nData: ${config.dataDir}\nOnly scan trusted websites you own or are authorized to test.`);
} catch (error) { console.error(error instanceof Error ? error.message : 'Startup failed'); await app.close(); process.exit(1); }
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
