import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TxDedup } from '../../src/webhook/dedup.js';

describe('TxDedup', () => {
  let dedup: TxDedup;

  beforeEach(() => {
    vi.useFakeTimers();
    dedup = new TxDedup();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for a new signature', () => {
    expect(dedup.isDuplicate('sig-1')).toBe(false);
  });

  it('returns true for a repeated signature within TTL', () => {
    dedup.isDuplicate('sig-1');
    expect(dedup.isDuplicate('sig-1')).toBe(true);
  });

  it('returns false after TTL expires', () => {
    dedup.isDuplicate('sig-1');
    vi.advanceTimersByTime(61_000);
    expect(dedup.isDuplicate('sig-1')).toBe(false);
  });

  it('handles multiple distinct signatures', () => {
    expect(dedup.isDuplicate('sig-a')).toBe(false);
    expect(dedup.isDuplicate('sig-b')).toBe(false);
    expect(dedup.isDuplicate('sig-a')).toBe(true);
    expect(dedup.isDuplicate('sig-b')).toBe(true);
    expect(dedup.isDuplicate('sig-c')).toBe(false);
  });

  it('cleans up expired entries during cleanup cycle', () => {
    dedup.isDuplicate('old-sig');
    vi.advanceTimersByTime(61_000);
    for (let i = 0; i < 100; i++) {
      dedup.isDuplicate(`filler-${i}`);
    }
    expect(dedup.isDuplicate('old-sig')).toBe(false);
  });
});
