---
title: "Telegram Channel Access Control — Join Request Auto-Approval Pattern"
date: 2026-04-02
category: best-practices
module: telegram
problem_type: best_practice
component: tooling
severity: medium
tags: [telegram, bot-api, access-control, subscription, webhook, channel-management]
applies_when: "Need to gate Telegram channel access by subscription status or any external auth system"
---

# Telegram Channel Access Control — Join Request Auto-Approval Pattern

## Context

Smart Money Radar needed to restrict Telegram alert channel access to paid subscribers only. Key constraints: no manual admin approval (24/7 automated), identity linking between web app (Clerk) and Telegram, and graceful handling of expired subscriptions.

Three approaches were evaluated:
1. **Invite link mode** — generate per-user links, kick expired users after joining (simple but insecure gap)
2. **Bot command mode** — user sends /join, bot adds them (requires bot to initiate, more friction)
3. **Join Request + Webhook** — channel requires admin approval, bot auto-approves/declines (most secure, chosen approach)

## Guidance

### Architecture: Three-Layer Access Control

```
Layer 1: Identity Binding (verification code)
  Dashboard generates 8-char hex code → User sends /bind CODE to Bot → DB links clerkUserId ↔ telegramId

Layer 2: Gate (Join Request auto-approval)
  User clicks invite link → Telegram sends chat_join_request → Bot checks binding + subscription → approve/decline

Layer 3: Cleanup (hourly cron)
  Scan expired subscriptions → kickChatMember (ban+unban) → private message notification
```

### Key Implementation Decisions

**Verification code binding over Telegram Login Widget**: Login Widget requires frontend JS SDK + OAuth callback, adding significant complexity. An 8-char hex code (generated server-side, 10-min TTL, single-use, in-memory Map) achieves the same identity linking with zero frontend dependencies. The user copies a code from Dashboard and sends it to the Bot — 2 steps, no OAuth.

**`creates_join_request: true` invite link**: Created once via `createChatInviteLink` API, stored as env var `TELEGRAM_INVITE_LINK`. All users share one link. The `creates_join_request` flag means clicking the link creates a pending request instead of instant join — the Bot gets `chat_join_request` update and decides.

**Fire-and-forget webhook**: Telegram retries on non-200, so the webhook must return 200 immediately. All approval/decline/messaging happens asynchronously after the response. Use `Promise.allSettled` for parallel Telegram API calls.

**Ban+unban for cleanup (not just ban)**: `banChatMember` removes from channel but permanently bans. Must immediately call `unbanChatMember` so the user can re-join after resubscribing. Critical: add retry on unban failure to prevent permanent bans.

### Required Bot Permissions

- `can_invite_users` — required to receive `chat_join_request` updates and call approve/decline
- `can_restrict_members` — required for `banChatMember`/`unbanChatMember` in cleanup

### `setWebhook` Configuration

```
allowed_updates: ["message", "chat_join_request"]
secret_token: <random 64-char hex> (验证 X-Telegram-Bot-Api-Secret-Token header)
```

The `secret_token` is self-generated (not from Telegram), shared between your server and the `setWebhook` call. Telegram includes it in every webhook request header for verification.

## Why This Matters

- **Security**: Users are verified BEFORE joining, not kicked AFTER — no window where non-subscribers see content
- **UX**: Click link → auto-approved in seconds (no manual admin, no waiting)
- **Graceful degradation**: Unbound users get a helpful private message with Dashboard link; expired users get a pricing link
- **Scalability**: One invite link for all users, no per-user link management

## When to Apply

- Gating Telegram channel/group access by any external auth system (subscription, role, whitelist)
- Any scenario requiring Telegram identity ↔ web app identity linking
- Automated channel membership lifecycle management

## Examples

### SQL gotcha: LEFT JOIN + NULL in cleanup query

```typescript
// WRONG: ne(subscriptions.status, 'active') misses NULL rows (no subscription record)
.where(ne(subscriptions.status, 'active'))

// RIGHT: explicitly handle NULL for users with no subscription
.where(or(ne(subscriptions.status, 'active'), isNull(subscriptions.status)))
```

### kickChatMember with unban retry

```typescript
export async function kickChatMember(chatId: string, userId: number, botToken: string): Promise<void> {
  await callTelegramApi('banChatMember', { chat_id: chatId, user_id: userId }, botToken);
  try {
    await callTelegramApi('unbanChatMember', { chat_id: chatId, user_id: userId, only_if_banned: true }, botToken);
  } catch {
    await new Promise((r) => setTimeout(r, 500));
    await callTelegramApi('unbanChatMember', { chat_id: chatId, user_id: userId, only_if_banned: true }, botToken);
  }
}
```

## Related Issues

- `docs/solutions/best-practices/fire-and-forget-webhook-graceful-degradation-2026-03-31.md` — webhook pattern reused here
- `docs/plans/2026-04-02-005-feat-telegram-channel-access-plan.md` — implementation plan
