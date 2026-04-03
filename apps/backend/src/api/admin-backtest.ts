// Admin backtest management API endpoints
// POST /api/v1/admin/backtest       — trigger a backtest run
// GET  /api/v1/admin/backtest/status — get current/latest run status
// GET  /api/v1/admin/backtest/report — get latest report markdown
// GET  /api/v1/admin/backtest/stream — SSE progress stream

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import { BacktestRunner } from '../scripts/backtest/runner.js';
import type { BacktestProgress, BacktestReport } from '../scripts/backtest/types.js';
import { formatMarkdownReport } from '../scripts/backtest/report.js';

// --- In-memory state ---

interface BacktestRun {
  runId: string;
  status: 'running' | 'complete' | 'error';
  progress: BacktestProgress | null;
  report: BacktestReport | null;
  markdown: string | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

let currentRun: BacktestRun | null = null;

const backtestBus = new EventEmitter();
backtestBus.setMaxListeners(20);

export interface AdminBacktestConfig {
  adminKey: string;
  birdeyeApiKey: string;
  heliusApiKey: string;
  discoveryStatePath: string;
}

export function registerAdminBacktestRoutes(
  app: FastifyInstance,
  config: AdminBacktestConfig,
) {
  // Admin auth hook — only for /api/v1/admin/* routes
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.url.startsWith('/api/v1/admin')) return;

    const key = request.headers['x-admin-key'];
    if (key !== config.adminKey) {
      return reply.status(403).send({ error: 'Admin access denied' });
    }
  });

  // POST /api/v1/admin/backtest — trigger a new run
  app.post('/api/v1/admin/backtest', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (currentRun?.status === 'running') {
      return reply.status(409).send({
        error: '回测正在运行中，请等待完成后再触发',
        runId: currentRun.runId,
      });
    }

    const runId = `run-${Date.now()}`;
    currentRun = {
      runId,
      status: 'running',
      progress: null,
      report: null,
      markdown: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    };

    // Start backtest async — don't await
    const outputDir = resolve(import.meta.dirname, '../../data/backtest');
    const runner = new BacktestRunner({
      birdeyeApiKey: config.birdeyeApiKey,
      heliusApiKey: config.heliusApiKey,
      outputDir,
      discoveryStatePath: config.discoveryStatePath,
      onProgress: (event: BacktestProgress) => {
        if (currentRun && currentRun.runId === runId) {
          currentRun.progress = event;
          backtestBus.emit('progress', event);
        }
      },
    });

    runner.run().then((report) => {
      if (currentRun && currentRun.runId === runId) {
        currentRun.status = 'complete';
        currentRun.report = report;
        currentRun.markdown = formatMarkdownReport(report);
        currentRun.completedAt = new Date().toISOString();
        backtestBus.emit('complete', { runId, report });
      }
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (currentRun && currentRun.runId === runId) {
        currentRun.status = 'error';
        currentRun.error = msg;
        currentRun.completedAt = new Date().toISOString();
        backtestBus.emit('backtest-error', { runId, error: msg });
      }
      app.log.error(`Backtest ${runId} failed: ${msg}`);
    });

    return reply.status(202).send({ runId, status: 'running' });
  });

  // GET /api/v1/admin/backtest/status
  app.get('/api/v1/admin/backtest/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!currentRun) {
      return reply.send({ status: 'idle', runId: null });
    }

    return reply.send({
      runId: currentRun.runId,
      status: currentRun.status,
      progress: currentRun.progress,
      startedAt: currentRun.startedAt,
      completedAt: currentRun.completedAt,
      error: currentRun.error,
    });
  });

  // GET /api/v1/admin/backtest/report
  app.get('/api/v1/admin/backtest/report', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!currentRun?.report) {
      return reply.status(404).send({ error: '暂无回测报告' });
    }

    return reply.send({
      runId: currentRun.runId,
      markdown: currentRun.markdown,
      stats: {
        smartMoney: currentRun.report.smartMoneyStats,
        baseline: currentRun.report.baselineStats,
      },
      passed: currentRun.report.passed,
      dataReliable: currentRun.report.dataReliable,
      generatedAt: currentRun.report.generatedAt,
    });
  });

  // GET /api/v1/admin/backtest/stream — SSE progress
  app.get(
    '/api/v1/admin/backtest/stream',
    async (request: FastifyRequest, reply: FastifyReply) => {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      reply.raw.write(': connected\n\n');

      // Send current state if a run is active
      if (currentRun) {
        reply.raw.write(`event: status\ndata: ${JSON.stringify({
          runId: currentRun.runId,
          status: currentRun.status,
          progress: currentRun.progress,
        })}\n\n`);
      }

      function onProgress(data: BacktestProgress) {
        reply.raw.write(`event: progress\ndata: ${JSON.stringify(data)}\n\n`);
      }

      function onComplete(data: { runId: string }) {
        reply.raw.write(`event: complete\ndata: ${JSON.stringify(data)}\n\n`);
      }

      function onError(data: { runId: string; error: string }) {
        reply.raw.write(`event: backtest-error\ndata: ${JSON.stringify(data)}\n\n`);
      }

      backtestBus.on('progress', onProgress);
      backtestBus.on('complete', onComplete);
      backtestBus.on('backtest-error', onError);

      const heartbeat = setInterval(() => {
        reply.raw.write(': heartbeat\n\n');
      }, 30_000);

      request.raw.on('close', () => {
        backtestBus.off('progress', onProgress);
        backtestBus.off('complete', onComplete);
        backtestBus.off('backtest-error', onError);
        clearInterval(heartbeat);
      });

      await reply.hijack();
    },
  );
}
