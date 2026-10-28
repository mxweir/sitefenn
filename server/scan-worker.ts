import type { Browser } from "playwright";
import {
  runAudit,
  closeAuditResources,
  type WorkerJob,
  type AuditEmitter,
} from "./audit-engine.js";
import type { ScanProgress } from "../shared/types.js";
export type { WorkerJob } from "./audit-engine.js";
export { discoverPages } from "./audit-engine.js";
let activeBrowser: Browser | undefined;
let paused = false;
let cancelled = false;
let wake: (() => void) | undefined;
export async function performScan(
  job: WorkerJob,
  emit: AuditEmitter = () => undefined,
) {
  let lastProgress: ScanProgress = {
    phase: "queued",
    message: "",
    completed: 0,
    total: 0,
    updatedAt: new Date().toISOString(),
  };
  const forward: AuditEmitter = (event) => {
    if (event.type === "progress") lastProgress = event.progress;
    emit(event);
  };
  return runAudit(
    job,
    forward,
    (browser) => {
      activeBrowser = browser;
    },
    {
      cancelled: () => cancelled,
      async checkpoint() {
        if (paused && !cancelled) {
          emit({
            type: "progress",
            progress: {
              ...lastProgress,
              phase: "paused",
              message: "Prüfung pausiert zwischen zwei Seitenschritten.",
              updatedAt: new Date().toISOString(),
            },
          });
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
          wake = undefined;
        }
        if (cancelled) throw new Error("Prüfung abgebrochen.");
      },
    },
  );
}
if (process.send) {
  const shutdown = () => {
    cancelled = true;
    wake?.();
    void closeAuditResources().finally(() => process.exit(0));
  };
  process.once("SIGTERM", shutdown);
  process.once("disconnect", shutdown);
  let started = false;
  process.on(
    "message",
    (
      message:
        | WorkerJob
        | { type: "control"; action: "pause" | "resume" | "cancel" },
    ) => {
      if ("type" in message && message.type === "control") {
        if (message.action === "pause") paused = true;
        if (message.action === "resume") {
          paused = false;
          wake?.();
        }
        if (message.action === "cancel") {
          cancelled = true;
          paused = false;
          wake?.();
          void closeAuditResources();
        }
        return;
      }
      if (started) return;
      started = true;
      void performScan(message as WorkerJob, (event) =>
        process.send?.(event),
      ).then(
        (result) => process.send?.({ result }, () => process.exit(0)),
        (error) =>
          process.send?.(
            {
              error: cancelled
                ? "Prüfung abgebrochen."
                : error instanceof Error
                  ? error.message.split("\n")[0]!.slice(0, 500)
                  : "Prüfung fehlgeschlagen.",
            },
            () => process.exit(1),
          ),
      );
    },
  );
}
