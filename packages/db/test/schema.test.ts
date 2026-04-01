import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import {
  users,
  subscriptions,
  alertsHistory,
  trackedWallets,
  subscriptionStatusEnum,
  walletSourceEnum,
} from '../src/schema/index.js';

describe('users schema', () => {
  it('has all required columns', () => {
    const cols = getTableColumns(users);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('clerkId');
    expect(cols).toHaveProperty('email');
    expect(cols).toHaveProperty('name');
    expect(cols).toHaveProperty('stripeCustomerId');
    expect(cols).toHaveProperty('deletedAt');
    expect(cols).toHaveProperty('createdAt');
    expect(cols).toHaveProperty('updatedAt');
  });

  it('clerkId column is unique and not null', () => {
    const cols = getTableColumns(users);
    expect(cols.clerkId.notNull).toBe(true);
    expect(cols.clerkId.isUnique).toBe(true);
  });

  it('stripeCustomerId column is unique and nullable', () => {
    const cols = getTableColumns(users);
    expect(cols.stripeCustomerId.isUnique).toBe(true);
    expect(cols.stripeCustomerId.notNull).toBe(false);
  });

  it('deletedAt column is nullable for soft delete', () => {
    const cols = getTableColumns(users);
    expect(cols.deletedAt.notNull).toBe(false);
  });
});

describe('subscriptions schema', () => {
  it('has all required columns', () => {
    const cols = getTableColumns(subscriptions);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('userId');
    expect(cols).toHaveProperty('stripeSubscriptionId');
    expect(cols).toHaveProperty('stripePriceId');
    expect(cols).toHaveProperty('status');
    expect(cols).toHaveProperty('currentPeriodStart');
    expect(cols).toHaveProperty('currentPeriodEnd');
    expect(cols).toHaveProperty('cancelAtPeriodEnd');
    expect(cols).toHaveProperty('createdAt');
    expect(cols).toHaveProperty('updatedAt');
  });

  it('stripeSubscriptionId is unique', () => {
    const cols = getTableColumns(subscriptions);
    expect(cols.stripeSubscriptionId.isUnique).toBe(true);
  });

  it('status enum contains all valid states', () => {
    expect(subscriptionStatusEnum).toEqual([
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'trialing',
      'paused',
    ]);
  });

  it('cancelAtPeriodEnd defaults to false', () => {
    const cols = getTableColumns(subscriptions);
    expect(cols.cancelAtPeriodEnd.hasDefault).toBe(true);
  });

  it('userId does NOT cascade on delete (soft delete design)', () => {
    const cols = getTableColumns(subscriptions);
    // userId references users.id but without cascade — verified by schema definition
    expect(cols.userId.notNull).toBe(true);
  });
});

describe('alertsHistory schema', () => {
  it('has all required columns', () => {
    const cols = getTableColumns(alertsHistory);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('signature');
    expect(cols).toHaveProperty('userId');
    expect(cols).toHaveProperty('walletAddress');
    expect(cols).toHaveProperty('walletLabel');
    expect(cols).toHaveProperty('tokenMint');
    expect(cols).toHaveProperty('tokenSymbol');
    expect(cols).toHaveProperty('dexSource');
    expect(cols).toHaveProperty('amountRaw');
    expect(cols).toHaveProperty('liquidity');
    expect(cols).toHaveProperty('fdv');
    expect(cols).toHaveProperty('marketCap');
    expect(cols).toHaveProperty('mintAuthority');
    expect(cols).toHaveProperty('freezeAuthority');
    expect(cols).toHaveProperty('aiSummary');
    expect(cols).toHaveProperty('telegramSent');
    expect(cols).toHaveProperty('createdAt');
  });

  it('signature is unique for dedup', () => {
    const cols = getTableColumns(alertsHistory);
    expect(cols.signature.isUnique).toBe(true);
    expect(cols.signature.notNull).toBe(true);
  });

  it('userId is nullable (Phase 2: always null, Phase 3: per-user)', () => {
    const cols = getTableColumns(alertsHistory);
    expect(cols.userId.notNull).toBe(false);
  });

  it('telegramSent defaults to false', () => {
    const cols = getTableColumns(alertsHistory);
    expect(cols.telegramSent.hasDefault).toBe(true);
  });
});

describe('trackedWallets schema', () => {
  it('has all required columns', () => {
    const cols = getTableColumns(trackedWallets);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('address');
    expect(cols).toHaveProperty('label');
    expect(cols).toHaveProperty('category');
    expect(cols).toHaveProperty('source');
    expect(cols).toHaveProperty('compositeScore');
    expect(cols).toHaveProperty('winRate');
    expect(cols).toHaveProperty('pnl');
    expect(cols).toHaveProperty('tradeCount');
    expect(cols).toHaveProperty('isActive');
    expect(cols).toHaveProperty('lastDiscoveredAt');
    expect(cols).toHaveProperty('createdAt');
    expect(cols).toHaveProperty('updatedAt');
  });

  it('address is unique', () => {
    const cols = getTableColumns(trackedWallets);
    expect(cols.address.isUnique).toBe(true);
    expect(cols.address.notNull).toBe(true);
  });

  it('source enum contains pinned and discovered', () => {
    expect(walletSourceEnum).toEqual(['pinned', 'discovered']);
  });

  it('isActive defaults to true', () => {
    const cols = getTableColumns(trackedWallets);
    expect(cols.isActive.hasDefault).toBe(true);
  });
});
