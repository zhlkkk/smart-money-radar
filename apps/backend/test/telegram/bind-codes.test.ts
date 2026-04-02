import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateBindCode, consumeBindCode } from '../../src/telegram/bind-codes.js';

describe('BindCodes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates an 8-character alphanumeric code', () => {
    const code = generateBindCode('user_123');
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  it('consume returns clerkUserId for a valid code', () => {
    const code = generateBindCode('user_abc');
    const result = consumeBindCode(code);
    expect(result).toBe('user_abc');
  });

  it('consume returns null for an expired code (>10 min)', () => {
    const code = generateBindCode('user_expired');
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    const result = consumeBindCode(code);
    expect(result).toBeNull();
  });

  it('consume returns null for an already-consumed code', () => {
    const code = generateBindCode('user_once');
    expect(consumeBindCode(code)).toBe('user_once');
    expect(consumeBindCode(code)).toBeNull();
  });

  it('consume returns null for an unknown code', () => {
    expect(consumeBindCode('NOTEXIST')).toBeNull();
  });

  it('overwrites previous code for same clerkUserId', () => {
    const code1 = generateBindCode('user_dup');
    const code2 = generateBindCode('user_dup');
    expect(code1).not.toBe(code2);
    // old code should be invalid
    expect(consumeBindCode(code1)).toBeNull();
    expect(consumeBindCode(code2)).toBe('user_dup');
  });

  it('cleans up expired entries on generate', () => {
    generateBindCode('user_old');
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    // This generate should trigger cleanup of the expired entry
    const newCode = generateBindCode('user_new');
    expect(consumeBindCode(newCode)).toBe('user_new');
  });
});
