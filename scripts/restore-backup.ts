import { open, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { restoreBackup } from "../server/backup.js";
import { backupMagic, restoreStreamBackup } from "../server/stream-backup.js";

const [archive, destination] = process.argv.slice(2);
if (!archive || !destination) {
  console.error(
    "Usage: npm run restore -- /path/to/backup.sitefenn /path/to/NEW-workspace",
  );
  process.exit(1);
}
try {
  const source = resolve(archive),
    target = resolve(destination);
  const file = await open(source, "r");
  const header = Buffer.alloc(backupMagic.length);
  try {
    await file.read(header, 0, header.length, 0);
  } finally {
    await file.close();
  }
  if (header.equals(backupMagic)) await restoreStreamBackup(source, target);
  else {
    if ((await stat(source)).size > 250 * 1024 * 1024)
      throw Error("ZIP-Sicherung überschreitet 250 MiB.");
    await restoreBackup(await readFile(source), target);
  }
  console.log(`Backup verified and restored to ${target}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Restore failed");
  process.exitCode = 1;
}
