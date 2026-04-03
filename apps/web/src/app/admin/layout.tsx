// Admin layout — Clerk role-based access control
// Only users with publicMetadata.role === 'admin' can access /admin/*

import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const metadata = user.publicMetadata as
    | { role?: string }
    | undefined;
  const isAdmin = metadata?.role === 'admin';

  if (!isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-smr-bg">
      <header className="border-b border-smr-border bg-smr-bg-secondary px-6 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-smr-text">Admin Console</h1>
          <span className="text-xs text-smr-text-muted">{user.emailAddresses[0]?.emailAddress}</span>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
