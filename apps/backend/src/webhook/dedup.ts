export class TxDedup {
  private seen: Map<string, number> = new Map();
  private readonly ttlMs: number;
  private callsSinceCleanup = 0;

  constructor(ttlMs = 60_000) {
    this.ttlMs = ttlMs;
  }

  isDuplicate(signature: string): boolean {
    const now = Date.now();
    if (++this.callsSinceCleanup >= 100) {
      this.cleanup(now);
      this.callsSinceCleanup = 0;
    }
    const ts = this.seen.get(signature);
    if (ts !== undefined) {
      if (now - ts <= this.ttlMs) return true;
      // Entry has expired; treat as new
    }
    this.seen.set(signature, now);
    return false;
  }

  private cleanup(now: number): void {
    for (const [sig, ts] of this.seen) {
      if (now - ts > this.ttlMs) {
        this.seen.delete(sig);
      }
    }
  }
}
