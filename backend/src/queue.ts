export class RunQueue {
  private readonly jobs: Array<() => Promise<void>> = [];
  private readonly idleWaiters: Array<() => void> = [];
  private readonly maxPending: number;
  private running = false;

  constructor(maxPending = 8) {
    if (!Number.isInteger(maxPending) || maxPending < 1) throw new RangeError('Queue capacity must be a positive integer.');
    this.maxPending = maxPending;
  }

  get pending(): number { return this.jobs.length + (this.running ? 1 : 0); }

  enqueue(job: () => Promise<void>): boolean {
    if (this.pending >= this.maxPending) return false;
    this.jobs.push(job);
    void this.drain();
    return true;
  }

  onIdle(): Promise<void> {
    if (!this.pending) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let job: (() => Promise<void>) | undefined;
      while ((job = this.jobs.shift())) {
        try { await job(); }
        catch { /* Run owners persist/report failures; one failure must not block the queue. */ }
      }
    } finally {
      this.running = false;
      for (const resolve of this.idleWaiters.splice(0)) resolve();
    }
  }
}
