'use client';

// Telegram 绑定引导组件
// 三种状态：未绑定 / 已绑定未订阅 / 已绑定已订阅

import { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import {
  MessageCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

type BindStatus = 'loading' | 'unbound' | 'bound' | 'bound_subscribed';

interface BindCodeResponse {
  code: string;
  expiresAt: string;
}

interface StatusResponse {
  status: string;
  telegramUsername?: string;
}

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'SmartMoneyRadarBot';

export function TelegramBind() {
  const t = useTranslations('telegram');
  const [bindStatus, setBindStatus] = useState<BindStatus>('loading');
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [bindCode, setBindCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 查询绑定状态
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram/status');
      if (!res.ok) {
        setBindStatus('unbound');
        return;
      }
      const data: StatusResponse = await res.json();
      if (data.status === 'bound') {
        setBindStatus('bound_subscribed');
        setTelegramUsername(data.telegramUsername ?? null);
      } else {
        setBindStatus('unbound');
      }
    } catch {
      setBindStatus('unbound');
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // 生成验证码
  const generateCode = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/telegram/bind-code');
      if (!res.ok) {
        setError(t('error'));
        return;
      }
      const data: BindCodeResponse = await res.json();
      setBindCode(data.code);
      setCodeExpiresAt(data.expiresAt);
    } catch {
      setError(t('error'));
    } finally {
      setGenerating(false);
    }
  };

  // 复制验证码
  const copyCode = async () => {
    if (!bindCode) return;
    try {
      await navigator.clipboard.writeText(bindCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级：选中文本
    }
  };

  // 计算验证码剩余分钟数
  const getExpiryMinutes = (): number => {
    if (!codeExpiresAt) return 5;
    const diff = new Date(codeExpiresAt).getTime() - Date.now();
    return Math.max(1, Math.ceil(diff / 60000));
  };

  // 加载中
  if (bindStatus === 'loading') {
    return (
      <GlassCard className="mb-6 p-5" hover={false}>
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-smr-text-muted" />
          <span className="text-sm text-smr-text-muted">{t('title')}</span>
        </div>
      </GlassCard>
    );
  }

  // 已绑定状态
  if (bindStatus === 'bound' || bindStatus === 'bound_subscribed') {
    return (
      <GlassCard className="mb-6 border-[var(--smr-accent-green)]/30 p-5" hover={false}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--smr-accent-green)]/10">
              <CheckCircle2 size={20} className="text-[var(--smr-accent-green)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-smr-text">{t('bound')}</span>
                <Badge variant="green">{t('channelJoined')}</Badge>
              </div>
              {telegramUsername && (
                <span className="text-sm text-smr-text-muted">
                  {t('boundUser', { username: telegramUsername })}
                </span>
              )}
            </div>
          </div>
          <MessageCircle size={20} className="text-[var(--smr-accent-green)]" />
        </div>
      </GlassCard>
    );
  }

  // 未绑定状态
  return (
    <GlassCard className="mb-6 p-5" hover={false}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--smr-accent-cyan)]/10">
          <MessageCircle size={20} className="text-[var(--smr-accent-cyan)]" />
        </div>
        <div>
          <span className="font-medium text-smr-text">{t('title')}</span>
          <p className="text-sm text-smr-text-muted">{t('notBound')}</p>
        </div>
      </div>

      {/* 步骤说明 */}
      <div className="mb-4 space-y-1.5 text-sm text-smr-text-secondary">
        <p>{t('bindStep1')}</p>
        <p>{t('bindStep2')}</p>
        <p>{t('bindStep3')}</p>
      </div>

      {/* 验证码区域 */}
      {bindCode ? (
        <div className="mb-4 space-y-3">
          {/* 验证码显示 */}
          <div className="flex items-center gap-3 rounded-lg bg-[var(--smr-bg-elevated)] px-4 py-3">
            <span className="font-data text-2xl font-bold tracking-widest text-[var(--smr-accent-cyan)]">
              {bindCode}
            </span>
            <button
              onClick={copyCode}
              className="ml-auto flex cursor-pointer items-center gap-1 rounded-md bg-[var(--smr-accent-cyan)]/10 px-3 py-1.5 text-xs text-[var(--smr-accent-cyan)] transition hover:bg-[var(--smr-accent-cyan)]/20"
            >
              {copied ? (
                <>
                  <Check size={12} />
                  {t('codeCopied')}
                </>
              ) : (
                <>
                  <Copy size={12} />
                  {t('copyCode')}
                </>
              )}
            </button>
          </div>

          {/* 过期提示 */}
          <p className="text-xs text-smr-text-muted">
            {t('codeExpiry', { minutes: String(getExpiryMinutes()) })}
          </p>

          {/* Bot 链接 + 重新生成 */}
          <div className="flex items-center gap-3">
            <a
              href={`https://t.me/${BOT_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-[#2AABEE]/10 px-4 py-2 text-sm font-medium text-[#2AABEE] transition hover:bg-[#2AABEE]/20"
            >
              {t('sendToBot')} @{BOT_USERNAME}
              <ExternalLink size={14} />
            </a>
            <button
              onClick={generateCode}
              disabled={generating}
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--smr-glass-border)] px-3 py-2 text-xs text-smr-text-muted transition hover:border-[var(--smr-border-hover)] hover:text-smr-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
              {t('regenerateCode')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 生成按钮 */}
          <button
            onClick={generateCode}
            disabled={generating}
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--smr-accent-cyan)]/10 px-4 py-2.5 text-sm font-medium text-[var(--smr-accent-cyan)] transition hover:bg-[var(--smr-accent-cyan)]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <MessageCircle size={16} />
            )}
            {t('generateCode')}
          </button>

          {/* 错误提示 */}
          {error && (
            <p className="text-xs text-[var(--smr-accent-red)]">{error}</p>
          )}
        </div>
      )}
    </GlassCard>
  );
}
