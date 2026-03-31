import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadDiscoveryState,
  saveDiscoveryState,
  type DiscoveryState,
} from '../../src/discovery/persistence.js';

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'persistence-test-'));
}

const sampleState: DiscoveryState = {
  discovered: [
    {
      address: 'So11111111111111111111111111111111',
      label: 'whale-1',
      category: 'degen',
      compositeScore: 85,
      missedCycles: 0,
      source: 'discovered',
    },
  ],
  lastRefresh: 1711843200000,
};

describe('persistence', () => {
  it('save then load returns the same data', () => {
    const dir = makeTmpDir();
    try {
      const filePath = join(dir, 'state.json');
      const saved = saveDiscoveryState(filePath, sampleState);
      expect(saved).toBe(true);

      const loaded = loadDiscoveryState(filePath);
      expect(loaded).toEqual(sampleState);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('load returns null when file does not exist', () => {
    const dir = makeTmpDir();
    try {
      const result = loadDiscoveryState(join(dir, 'nonexistent.json'));
      expect(result).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('load returns null on corrupted JSON', () => {
    const dir = makeTmpDir();
    try {
      const filePath = join(dir, 'corrupted.json');
      writeFileSync(filePath, '{not valid json!!!', 'utf-8');

      const result = loadDiscoveryState(filePath);
      expect(result).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('load returns null on empty file', () => {
    const dir = makeTmpDir();
    try {
      const filePath = join(dir, 'empty.json');
      writeFileSync(filePath, '', 'utf-8');

      const result = loadDiscoveryState(filePath);
      expect(result).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('save overwrites existing file', () => {
    const dir = makeTmpDir();
    try {
      const filePath = join(dir, 'state.json');

      const first: DiscoveryState = {
        discovered: [],
        lastRefresh: 1000,
      };
      saveDiscoveryState(filePath, first);

      const second: DiscoveryState = {
        discovered: sampleState.discovered,
        lastRefresh: 2000,
      };
      const saved = saveDiscoveryState(filePath, second);
      expect(saved).toBe(true);

      const loaded = loadDiscoveryState(filePath);
      expect(loaded).toEqual(second);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('save returns false on write error (non-existent directory)', () => {
    const result = saveDiscoveryState(
      '/no/such/directory/state.json',
      sampleState,
    );
    expect(result).toBe(false);
  });
});
