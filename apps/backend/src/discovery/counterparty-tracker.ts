import type { HeliusEnhancedTransaction } from '../types.js';
import type { WalletCandidate } from '../types.js';
import { SOURCE_WEIGHTS } from './scoring.js';

export interface CounterpartyTrackerConfig {
  windowMs?: number; // default 7 days
  minOverlap?: number; // default 3
  highFrequencyThreshold?: number; // default 100
}

export interface CounterpartyTracker {
  recordSwap: (tx: HeliusEnhancedTransaction, monitoredAddresses: Set<string>) => void;
  getCandidates: (threshold?: number) => WalletCandidate[];
  getStats: () => { totalTracked: number; totalGlobalCounts: number };
}

interface CounterpartyEntry {
  monitoredWallets: Set<string>;
  lastSeen: number;
}

// Known system program addresses
const SYSTEM_ADDRESSES = new Set([
  '11111111111111111111111111111111', // System Program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Program
]);

// DEX program addresses by source
const DEX_PROGRAMS: Record<string, string> = {
  JUPITER: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  RAYDIUM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  ORCA: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function createCounterpartyTracker(config: CounterpartyTrackerConfig = {}): CounterpartyTracker {
  const windowMs = config.windowMs ?? SEVEN_DAYS_MS;
  const minOverlap = config.minOverlap ?? 3;
  const highFrequencyThreshold = config.highFrequencyThreshold ?? 100;

  const counterparties = new Map<string, CounterpartyEntry>();
  const globalCounts = new Map<string, number>();

  function extractCounterpartyAddresses(tx: HeliusEnhancedTransaction): string[] {
    const addresses = new Set<string>();

    // Path 1: events.swap
    if (tx.events?.swap?.tokenInputs?.length || tx.events?.swap?.tokenOutputs?.length) {
      for (const input of tx.events?.swap?.tokenInputs ?? []) {
        if (input.userAccount) addresses.add(input.userAccount);
      }
      for (const output of tx.events?.swap?.tokenOutputs ?? []) {
        if (output.userAccount) addresses.add(output.userAccount);
      }
    } else {
      // Path 2 (fallback): tokenTransfers
      for (const transfer of tx.tokenTransfers ?? []) {
        if (transfer.fromUserAccount) addresses.add(transfer.fromUserAccount);
        if (transfer.toUserAccount) addresses.add(transfer.toUserAccount);
      }
    }

    return Array.from(addresses);
  }

  function buildFilterSet(
    tx: HeliusEnhancedTransaction,
    monitoredAddresses: Set<string>,
  ): Set<string> {
    const filterSet = new Set<string>(SYSTEM_ADDRESSES);

    // Add monitored addresses
    for (const addr of monitoredAddresses) {
      filterSet.add(addr);
    }

    // Add DEX program for tx.source
    const dexProgram = tx.source ? DEX_PROGRAMS[tx.source] : undefined;
    if (dexProgram) {
      filterSet.add(dexProgram);
    }

    // Always filter feePayer
    if (tx.feePayer) {
      filterSet.add(tx.feePayer);
    }

    return filterSet;
  }

  function findMonitoredWallet(
    tx: HeliusEnhancedTransaction,
    monitoredAddresses: Set<string>,
  ): string | undefined {
    // Check feePayer first
    if (tx.feePayer && monitoredAddresses.has(tx.feePayer)) {
      return tx.feePayer;
    }

    // Check swap events
    if (tx.events?.swap) {
      for (const input of tx.events.swap.tokenInputs ?? []) {
        if (input.userAccount && monitoredAddresses.has(input.userAccount)) {
          return input.userAccount;
        }
      }
      for (const output of tx.events.swap.tokenOutputs ?? []) {
        if (output.userAccount && monitoredAddresses.has(output.userAccount)) {
          return output.userAccount;
        }
      }
    }

    // Check tokenTransfers
    for (const transfer of tx.tokenTransfers ?? []) {
      if (transfer.fromUserAccount && monitoredAddresses.has(transfer.fromUserAccount)) {
        return transfer.fromUserAccount;
      }
      if (transfer.toUserAccount && monitoredAddresses.has(transfer.toUserAccount)) {
        return transfer.toUserAccount;
      }
    }

    return undefined;
  }

  function recordSwap(tx: HeliusEnhancedTransaction, monitoredAddresses: Set<string>): void {
    const rawAddresses = extractCounterpartyAddresses(tx);
    const filterSet = buildFilterSet(tx, monitoredAddresses);
    const monitoredWallet = findMonitoredWallet(tx, monitoredAddresses);

    if (!monitoredWallet) return;

    for (const addr of rawAddresses) {
      // Layer 1 & 2: filter system + DEX + monitored + feePayer
      if (filterSet.has(addr)) continue;

      // Layer 3: high-frequency filter
      const count = (globalCounts.get(addr) ?? 0) + 1;
      globalCounts.set(addr, count);
      if (count > highFrequencyThreshold) continue;

      // Update counterparty entry
      const entry = counterparties.get(addr) ?? {
        monitoredWallets: new Set<string>(),
        lastSeen: 0,
      };
      entry.monitoredWallets.add(monitoredWallet);
      entry.lastSeen = Date.now();
      counterparties.set(addr, entry);
    }
  }

  function getCandidates(threshold?: number): WalletCandidate[] {
    const minWallets = threshold ?? minOverlap;
    const now = Date.now();
    const candidates: WalletCandidate[] = [];

    // Clean expired entries and collect candidates
    for (const [address, entry] of counterparties) {
      if (now - entry.lastSeen > windowMs) {
        counterparties.delete(address);
        continue;
      }

      // Check overlap threshold
      if (entry.monitoredWallets.size < minWallets) continue;

      // Double-check high-frequency filter
      const count = globalCounts.get(address) ?? 0;
      if (count > highFrequencyThreshold) continue;

      candidates.push({
        address,
        pnl: NaN,
        winRate: NaN,
        tradeCount: NaN,
        lastActiveTimestamp: entry.lastSeen,
        sources: [
          {
            source: 'helius-reverse',
            weight: SOURCE_WEIGHTS['helius-reverse'] ?? 0.5,
            discoveredAt: now,
          },
        ],
      });
    }

    return candidates;
  }

  function getStats(): { totalTracked: number; totalGlobalCounts: number } {
    return {
      totalTracked: counterparties.size,
      totalGlobalCounts: globalCounts.size,
    };
  }

  return { recordSwap, getCandidates, getStats };
}
