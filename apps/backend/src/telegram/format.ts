import type { AlertData } from '../types.js';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatUsd(value: number | null): string {
  if (value === null) return 'N/A';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

export function formatAuthority(value: string | null | 'unchecked'): string {
  if (value === null) return '✅ Revoked';
  if (value === 'unchecked') return '❓ Unchecked';
  return '⚠️ Active';
}

export function truncateMint(mint: string): string {
  if (mint.length <= 8) return mint;
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

export function formatAlert(data: AlertData): string {
  const { wallet, swap, enrichment, riskAssessment, aiSummary, confidence } = data;
  const label = escapeHtml(wallet.label);
  const category = escapeHtml(wallet.category);
  const tokenDisplay = swap.tokenSymbol ? escapeHtml(swap.tokenSymbol) : truncateMint(swap.tokenMint);
  const liq = formatUsd(enrichment.liquidity);
  const fdv = formatUsd(enrichment.fdv);
  const mc = formatUsd(enrichment.marketCap);
  const vol = formatUsd(enrichment.volume24h);
  const txns = enrichment.txns24h
    ? `${enrichment.txns24h.buys} buys / ${enrichment.txns24h.sells} sells`
    : 'N/A';
  const mintStatus = formatAuthority(enrichment.mintAuthority);
  const freezeStatus = formatAuthority(enrichment.freezeAuthority);

  const lines: string[] = [
    `🐋 <b>${label}</b> (${category}) bought <code>${tokenDisplay}</code>  ${riskAssessment.label}`,
    `📊 <b>${escapeHtml(confidence.label)}</b>`,
    '',
    `💰 Liq: <b>${liq}</b> | FDV: <b>${fdv}</b> | MC: <b>${mc}</b>`,
    `📈 Vol 24h: <b>${vol}</b> | Txns: ${txns}`,
    `🔒 Mint: ${mintStatus} | Freeze: ${freezeStatus}`,
  ];
  if (aiSummary) {
    lines.push('', `🤖 <i>${escapeHtml(aiSummary)}</i>`);
  }
  lines.push(
    '',
    `🔍 数据源: Helius → DexScreener → Claude`,
    `📌 <a href="https://birdeye.so/token/${swap.tokenMint}?chain=solana">Birdeye</a> | <a href="https://dexscreener.com/solana/${swap.tokenMint}">DexScreener</a>`,
    '',
    `<i>数据来自第三方 API，仅供参考，不构成投资建议</i>`,
  );
  return lines.join('\n');
}
