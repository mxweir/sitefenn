import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { restoreBackup } from "../server/backup.js";
const [archive, destination] = process.argv.slice(2);
if (!archive || !destination) {
  console.error(
    "Usage: npm run restore -- /path/to/sitefenn-backup.zip /path/to/NEW-workspace",
  );
  process.exit(1);
}
try {
  await restoreBackup(await readFile(resolve(archive)), resolve(destination));
  console.log(
    `Backup verified and restored to ${resolve(destination)}. Stop the old Hub before starting with HUB_DATA_DIR pointing to this new directory.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Restore failed");
  process.exit(1);
}
