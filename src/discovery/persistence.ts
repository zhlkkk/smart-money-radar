import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import type { DiscoveryState } from './scoring.js';

export type { DiscoveryState } from './scoring.js';

/**
 * Load discovery state from a JSON file (synchronous, for startup).
 * Returns null if the file doesn't exist, is empty, or contains invalid JSON.
 */
export function loadDiscoveryState(filePath: string): DiscoveryState | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed as DiscoveryState;
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return null;
    }
    console.warn(`Failed to load discovery state from ${filePath}:`, err);
    return null;
  }
}

/**
 * Atomically save discovery state to a JSON file.
 * Writes to a temp file then renames to avoid partial writes.
 * Returns true on success, false on failure. Never throws.
 */
export function saveDiscoveryState(
  filePath: string,
  state: DiscoveryState,
): boolean {
  const tmpPath = `${filePath}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    renameSync(tmpPath, filePath);
    return true;
  } catch (err) {
    console.warn(`Failed to save discovery state to ${filePath}:`, err);
    return false;
  }
}
