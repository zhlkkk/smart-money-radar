'use client';

// 打字机效果 — 逐字显示文本

import { useEffect, useState } from 'react';

interface TypingTextProps {
  text: string;
  speed?: number; // ms per character
  delay?: number; // 开始延迟
  className?: string;
  cursor?: boolean;
}

export function TypingText({
  text,
  speed = 40,
  delay = 500,
  className = '',
  cursor = true,
}: TypingTextProps) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayed(text);
      setDone(true);
      return;
    }

    const startTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimer);
  }, [delay, text]);

  useEffect(() => {
    if (!started || done) return;

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [started, text, speed, done]);

  return (
    <span className={className}>
      {displayed}
      {cursor && !done && (
        <span
          className="ml-0.5 inline-block h-[1.1em] w-[2px] align-middle bg-[var(--smr-accent-cyan)]"
          style={{ animation: 'typing-cursor 0.8s step-end infinite' }}
        />
      )}
    </span>
  );
}
