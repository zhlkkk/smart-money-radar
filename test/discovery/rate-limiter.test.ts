import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRateLimiter } from '../../src/discovery/rate-limiter.js';

describe('createRateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within limit', async () => {
    const limiter = createRateLimiter(5);

    // Should resolve immediately for 5 requests
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }
    // If we get here, all 5 resolved without blocking
    expect(true).toBe(true);
  });

  it('delays requests when limit exceeded', async () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter(2);

    // Exhaust both tokens
    await limiter.acquire();
    await limiter.acquire();

    // Third request should wait
    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // Not resolved yet
    expect(resolved).toBe(false);

    // Advance time to next refill interval (60000ms / 2 = 30000ms)
    await vi.advanceTimersByTimeAsync(30_000);

    await promise;
    expect(resolved).toBe(true);
  });

  it('processes multiple waiters in order', async () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter(1);

    // Exhaust the single token
    await limiter.acquire();

    const order: number[] = [];
    const p1 = limiter.acquire().then(() => order.push(1));
    const p2 = limiter.acquire().then(() => order.push(2));

    // Advance past two refill intervals (60000ms each for rate of 1/min)
    await vi.advanceTimersByTimeAsync(60_000);
    await p1;

    await vi.advanceTimersByTimeAsync(60_000);
    await p2;

    expect(order).toEqual([1, 2]);
  });
});
