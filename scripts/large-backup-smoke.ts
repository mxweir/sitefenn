import assert from "node:assert/strict";
import { mkdtemp, open, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.js";
import {
  restoreStreamBackup,
  writeStreamBackup,
} from "../server/stream-backup.js";

const root = await mkdtemp(join(tmpdir(), "sitefenn-large-backup-"));
const source = new Store(join(root, "source"));
try {
  const project = source.createProject(
    "Backup benchmark",
    "https://owned.example/",
    "production",
  );
  for (let index = 0; index < 2000; index++)
    await writeFile(
      join(source.dataDir, "evidence", `small-${index}.png`),
      "Synthetic evidence sample",
    );
  const largest = join(source.dataDir, "evidence", "large.png");
  const handle = await open(largest, "wx");
  const inputBytes = 260 * 1024 * 1024;
  try {
    await handle.truncate(inputBytes);
  } finally {
    await handle.close();
  }
  const archivePath = join(root, "backup.sitefenn"),
    destination = join(root, "restored");
  const start = performance.now();
  await writeStreamBackup({
    dataDir: source.dataDir,
    snapshotPath: join(root, "snapshot.sqlite"),
    archivePath,
    progress: () => {},
  });
  const writtenAt = performance.now();
  await restoreStreamBackup(archivePath, destination);
  const restoredAt = performance.now(),
    restored = new Store(destination);
  try {
    assert.equal(restored.project(project.id)?.name, project.name);
  } finally {
    restored.close();
  }
  assert.equal((await readdir(join(destination, "evidence"))).length, 2001);
  assert.equal(
    (await stat(join(destination, "evidence", "large.png"))).size,
    inputBytes,
  );
  const peakMiB = process.resourceUsage().maxRSS / 1024;
  assert.ok(
    peakMiB < 192,
    `Expected <192 MiB RSS, measured ${peakMiB.toFixed(1)} MiB`,
  );
  console.log(
    JSON.stringify({
      synthetic: true,
      platform: process.platform,
      node: process.version,
      evidenceFiles: 2001,
      largestFileBytes: inputBytes,
      archiveBytes: (await stat(archivePath)).size,
      writerMs: Math.round(writtenAt - start),
      restoreMs: Math.round(restoredAt - writtenAt),
      processPeakRssMiB: Math.round(peakMiB * 10) / 10,
      budgetMiB: 192,
      integrityVerified: true,
    }),
  );
} finally {
  source.close();
  await rm(root, { recursive: true, force: true });
}
