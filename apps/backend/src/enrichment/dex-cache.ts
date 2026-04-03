import type { DexScreenerData } from '../types.js';

interface CacheEntry {
  data: DexScreenerData;
  timestamp: number;
}

interface DexCacheOptions {
  ttlMs?: number;
  maxSize?: number;
}

export class DexCache {
  private readonly entries: Map<string, CacheEntry> = new Map();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(options: DexCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? 30_000;
    this.maxSize = options.maxSize ?? 2_000;
  }

  get(mint: string): DexScreenerData | null {
    const entry = this.entries.get(mint);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) return null;
    return entry.data;
  }

  getStale(mint: string): DexScreenerData | null {
    const entry = this.entries.get(mint);
    return entry?.data ?? null;
  }

  set(mint: string, data: DexScreenerData): void {
    // Delete first so re-insert moves key to end of Map iteration order
    this.entries.delete(mint);
    this.entries.set(mint, { data, timestamp: Date.now() });
    this.evict();
  }

  get size(): number {
    return this.entries.size;
  }

  private evict(): void {
    while (this.entries.size > this.maxSize) {
      // Map iterator yields in insertion order; first key is the oldest
      const oldest = this.entries.keys().next();
      if (!oldest.done) {
        this.entries.delete(oldest.value);
      }
    }
  }
}
