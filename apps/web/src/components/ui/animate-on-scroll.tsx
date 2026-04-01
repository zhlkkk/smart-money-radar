'use client';

// 滚动入场动画 — Intersection Observer
// 元素进入视口时触发 CSS 动画

import { useEffect, useRef, useState, type ReactNode } from 'react';

type AnimationType = 'fade-up' | 'slide-left' | 'slide-right' | 'scale-in' | 'fade-in';

interface AnimateOnScrollProps {
  children: ReactNode;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  className?: string;
  threshold?: number;
}

const animationMap: Record<AnimationType, string> = {
  'fade-up': 'float-up',
  'slide-left': 'slide-in-left',
  'slide-right': 'slide-in-right',
  'scale-in': 'scale-in',
  'fade-in': 'fade-in',
};

export function AnimateOnScroll({
  children,
  animation = 'fade-up',
  delay = 0,
  duration = 600,
  className = '',
  threshold = 0.15,
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 尊重 prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        animation: isVisible
          ? `${animationMap[animation]} ${duration}ms ease-out ${delay}ms both`
          : 'none',
      }}
    >
      {children}
    </div>
  );
}
