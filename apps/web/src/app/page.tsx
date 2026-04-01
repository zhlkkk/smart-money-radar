import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="mb-4 text-4xl font-bold tracking-tight text-[#00F0FF]">
        Smart Money Radar
      </h1>
      <p className="mb-8 max-w-md text-center text-lg text-zinc-400">
        Solana 聪明钱实时追踪，比散户快 10 分钟
      </p>
      <div className="flex gap-4">
        <SignedOut>
          <Link
            href="/sign-in"
            className="rounded-md border border-[#00F0FF]/30 bg-[#111111] px-6 py-3 text-[#00F0FF] transition hover:bg-[#00F0FF]/10"
          >
            登录
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-[#00F0FF] px-6 py-3 font-medium text-black transition hover:bg-[#00F0FF]/80"
          >
            注册
          </Link>
        </SignedOut>
        <SignedIn>
          <Link
            href="/dashboard"
            className="rounded-md bg-[#00F0FF] px-6 py-3 font-medium text-black transition hover:bg-[#00F0FF]/80"
          >
            进入控制台
          </Link>
        </SignedIn>
      </div>
    </main>
  );
}
