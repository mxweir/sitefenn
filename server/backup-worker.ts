import { writeStreamBackup } from "./stream-backup.js";
import { failureCode } from "./jobs.js";

process.once("disconnect", () => process.exit(1));
process.once(
  "message",
  async (input: Omit<Parameters<typeof writeStreamBackup>[0], "progress">) => {
    try {
      await writeStreamBackup({
        ...input,
        progress: (completed, total) => process.send?.({ completed, total }),
      });
      process.send?.({ done: true }, () => process.exit(0));
    } catch (error) {
      process.send?.({ failure: failureCode(error) }, () => process.exit(1));
    }
  },
);
