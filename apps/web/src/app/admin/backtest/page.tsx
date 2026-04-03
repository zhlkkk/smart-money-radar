// Admin backtest management page
// Server component that renders the client-side backtest panel

import { BacktestPanel } from '@/components/admin/backtest-panel';

export const dynamic = 'force-dynamic';

export default function AdminBacktestPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 text-xl font-bold text-smr-text">Backtest Management</h2>
      <BacktestPanel />
    </div>
  );
}
