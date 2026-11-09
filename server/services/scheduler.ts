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
  catchUp?: "skip" | "once";
  waitingSince?: string;
}
export class Scheduler {
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;
  private lastTick?: number;
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
    catchUp: unknown = "skip",
  ) {
    if (
      ![24, 168].includes(Number(intervalHours)) ||
      typeof intervalHours !== "number" ||
      typeof enabled !== "boolean"
    )
      throw Error("Intervall: 24 oder 168 Stunden.");
    if (catchUp !== "skip" && catchUp !== "once")
      throw Error("Nachholregel: überspringen oder einmal nachholen.");
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
      catchUp,
      nextRunAt: new Date(this.now() + intervalHours * 3600000).toISOString(),
      lastState: enabled ? "Geplant · nur bei laufender App" : "Deaktiviert",
      missed: 0,
    };
    this.lastTick ??= this.now();
    this.store.savePreference(`schedule:${projectId}`, value);
    return value;
  }
  startTimer() {
    if (!this.timer) {
      this.timer = setInterval(() => {
        try {
          this.tick();
        } catch {
          /* Retry on the next tick after storage recovers. */
        }
      }, 30000);
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
      const now = this.now();
      const previous =
        this.lastTick ??
        Number(this.store.preference("scheduler:last-tick") ?? 0);
      this.lastTick = now;
      let started = false;
      for (const schedule of this.list()) {
        const due = Date.parse(schedule.nextRunAt);
        if (!schedule.enabled || due > now) continue;
        const interval = schedule.intervalHours * 3600000;
        const downtime =
          !Number.isFinite(due) ||
          (!schedule.waitingSince &&
            due >= previous &&
            now - due > 5 * 60000 &&
            now - previous > 5 * 60000);
        if (downtime) {
          schedule.missed += Number.isFinite(due)
            ? Math.floor((now - due) / interval) + 1
            : 1;
          if (schedule.catchUp !== "once") {
            schedule.lastState =
              "Termin während App-Pause verpasst · übersprungen";
            schedule.nextRunAt = new Date(now + interval).toISOString();
            this.store.savePreference(
              `schedule:${schedule.projectId}`,
              schedule,
            );
            continue;
          }
          schedule.waitingSince = new Date(now).toISOString();
        }
        if (started || this.busy()) {
          schedule.waitingSince ??= new Date(now).toISOString();
          schedule.lastState = "Wartet auf freie Ressourcen";
          this.store.savePreference(`schedule:${schedule.projectId}`, schedule);
          continue;
        }
        const scan = this.store.scan(schedule.sourceScanId);
        if (!scan?.options) {
          delete schedule.waitingSince;
          schedule.enabled = false;
          schedule.lastState = "Profilquelle fehlt · erneut freigeben";
        } else {
          try {
            const next = this.start(schedule.projectId, scan.options);
            started = true;
            delete schedule.waitingSince;
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
      }
      this.store.savePreference("scheduler:last-tick", now);
    } finally {
      this.ticking = false;
    }
  }
}
