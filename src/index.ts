import "dotenv/config";
import { config, validateConfig } from "./config.js";
import { createApp, logStartup } from "./createApp.js";

async function main(): Promise<void> {
  validateConfig();
  const app = createApp();
  await app.start(config.port);
  logStartup();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
