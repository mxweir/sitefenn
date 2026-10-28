import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { ScanResult } from '../shared/types.js';
import type { WorkerJob } from './scan-worker.js';
import type { Store } from './store.js';

export class Runner {
  private active?: ChildProcess;
  private hardStop?: ReturnType<typeof setTimeout>;
  private closing = false;
  constructor(private store: Store, private origin: string) {}
  enqueue() { void this.next(); }
  private async next() {
    if (this.active || this.closing) return;
    const scan = this.store.scans().reverse().find(item => item.status === 'queued');
    if (!scan) return;
    const project = this.store.project(scan.projectId)!;
    this.store.running(scan.id);
    const workerPath = new URL(import.meta.url.endsWith('.ts') ? './scan-worker.ts' : './scan-worker.js', import.meta.url);
    const child = fork(fileURLToPath(workerPath), [], { execArgv: workerPath.pathname.endsWith('.ts') ? ['--import', 'tsx'] : [], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    this.active = child;
    let settled = false;
    const timeout = setTimeout(() => { settle('Die Prüfung hat das Zeitlimit von 60 Sekunden überschritten.'); this.stop(child); }, 60_000);
    const settle = (error?: string, result?: ScanResult) => {
      if (settled) return;
      settled = true; clearTimeout(timeout);
      if (error) this.store.fail(scan.id, error);
      else if (result) this.store.finish(scan.id, result);
    };
    child.on('message', (message: { result?: ScanResult; error?: string }) => { if (!this.closing) settle(message.error, message.result); });
    child.on('error', error => settle(error.message));
    child.on('exit', () => {
      if (!this.closing) settle('Der Prüf-Browser wurde unerwartet beendet. Prüfe, ob Chromium installiert ist.');
      clearTimeout(timeout); clearTimeout(this.hardStop); this.active = undefined;
      if (!this.closing) void this.next();
    });
    child.stderr?.on('data', () => { /* Never surface raw target-controlled output as HTML. */ });
    const demo = this.store.isDemo(project.id);
    const job: WorkerJob = { id: scan.id, url: demo ? `${this.origin}/demo-site` : project.url, dataDir: this.store.dataDir, demoOrigin: demo ? this.origin : undefined };
    child.send(job);
  }
  private stop(child: ChildProcess) {
    child.kill('SIGTERM');
    this.hardStop = setTimeout(() => child.kill('SIGKILL'), 5000);
  }
  async close() {
    this.closing = true;
    if (this.active) {
      const child = this.active;
      const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
      this.stop(child); await exited;
    }
  }
}
