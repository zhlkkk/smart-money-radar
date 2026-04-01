import { UserButton } from '@clerk/nextjs';

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#0A0A0A] p-8">
      <header className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <h1 className="text-2xl font-bold text-[#00F0FF]">Dashboard</h1>
        <UserButton />
      </header>
      <div className="mt-8 flex flex-1 items-center justify-center">
        <p className="text-zinc-500">告警历史和钱包详情将在 Unit 8 中实现</p>
      </div>
    </main>
  );
}
