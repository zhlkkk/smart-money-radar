export interface RateLimiter {
  acquire(): Promise<void>;
}

/**
 * Simple token bucket rate limiter.
 * Tokens refill at a constant rate (maxPerMinute tokens per 60 seconds).
 * acquire() resolves immediately if a token is available, otherwise waits.
 */
export function createRateLimiter(maxPerMinute: number): RateLimiter {
  let tokens = maxPerMinute;
  const intervalMs = 60_000 / maxPerMinute;
  let refillTimer: ReturnType<typeof setInterval> | null = null;
  const waitQueue: Array<() => void> = [];

  function startRefill(): void {
    if (refillTimer) return;
    refillTimer = setInterval(() => {
      if (waitQueue.length > 0) {
        // Give the token directly to a waiter instead of incrementing
        const resolve = waitQueue.shift()!;
        resolve();
      } else if (tokens < maxPerMinute) {
        tokens++;
      }

      // Stop the timer when fully refilled and no waiters
      if (tokens >= maxPerMinute && waitQueue.length === 0 && refillTimer) {
        clearInterval(refillTimer);
        refillTimer = null;
      }
    }, intervalMs);
  }

  return {
    acquire(): Promise<void> {
      if (tokens > 0) {
        tokens--;
        startRefill();
        return Promise.resolve();
      }

      startRefill();
      return new Promise<void>((resolve) => {
        waitQueue.push(resolve);
      });
    },
  };
}
