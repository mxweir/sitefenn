import type { Store } from "../store.js";
import type { ScanOptions } from "../../shared/types.js";
export interface Schedule {
  projectId: string;
  sourceScanId: string;
  intervalHours: 24 | 168;
  enabled: boolean;
  nextRunAt: string;
  lastState: string;
  missed: number;
  lastScanId?: string;
}
export class Scheduler {
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;
  constructor(
    private store: Store,
    private busy: () => boolean,
    private start: (projectId: string, options: ScanOptions) => { id: string },
    private now = () => Date.now(),
  ) {}
  list() {
    return this.store.projects().flatMap((p) => {
      const value = this.store.preference(`schedule:${p.id}`) as
        | Schedule
        | undefined;
      return value ? [value] : [];
    });
  }
  configure(
    projectId: string,
    sourceScanId: string,
    intervalHours: unknown,
    enabled: unknown,
  ) {
    if (
      ![24, 168].includes(Number(intervalHours)) ||
      typeof intervalHours !== "number" ||
      typeof enabled !== "boolean"
    )
      throw Error("Intervall: 24 oder 168 Stunden.");
    const scan = this.store.scan(sourceScanId);
    if (
      !scan ||
      scan.projectId !== projectId ||
      scan.status !== "completed" ||
      !scan.options ||
      scan.options.retest
    )
      throw Error(
        "Abgeschlossenen vollständigen Projekt-Check als Zeitplan wählen.",
      );
    const value: Schedule = {
      projectId,
      sourceScanId,
      intervalHours: intervalHours as 24 | 168,
      enabled,
      nextRunAt: new Date(this.now() + intervalHours * 3600000).toISOString(),
      lastState: enabled ? "Geplant · nur bei laufender App" : "Deaktiviert",
      missed: 0,
    };
    this.store.savePreference(`schedule:${projectId}`, value);
    return value;
  }
  startTimer() {
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), 30000);
      this.timer.unref();
      this.tick();
    }
  }
  close() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      for (const schedule of this.list()) {
        if (!schedule.enabled || Date.parse(schedule.nextRunAt) > this.now())
          continue;
        const late = this.now() - Date.parse(schedule.nextRunAt);
        if (!Number.isFinite(late) || late > 5 * 60000) {
          schedule.missed += Number.isFinite(late)
            ? Math.floor(late / (schedule.intervalHours * 3600000)) + 1
            : 1;
          schedule.lastState =
            "Termin verpasst · kein automatischer Nachholstapel";
          schedule.nextRunAt = new Date(
            this.now() + schedule.intervalHours * 3600000,
          ).toISOString();
          this.store.savePreference(`schedule:${schedule.projectId}`, schedule);
          continue;
        }
        if (this.busy()) {
          schedule.lastState = "Wartet auf freie Ressourcen";
          this.store.savePreference(`schedule:${schedule.projectId}`, schedule);
          continue;
        }
        const scan = this.store.scan(schedule.sourceScanId);
        if (!scan?.options) {
          schedule.enabled = false;
          schedule.lastState = "Profilquelle fehlt · erneut freigeben";
        } else {
          try {
            const next = this.start(schedule.projectId, scan.options);
            schedule.lastScanId = next.id;
            schedule.lastState = "Prüfung eingereiht";
            schedule.nextRunAt = new Date(
              this.now() + schedule.intervalHours * 3600000,
            ).toISOString();
          } catch {
            schedule.lastState = "Prüfung konnte nicht starten · Umfang prüfen";
            schedule.enabled = false;
          }
        }
        this.store.savePreference(`schedule:${schedule.projectId}`, schedule);
        break;
      }
    } finally {
      this.ticking = false;
    }
  }
}
