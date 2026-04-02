// SSE 实时告警推送端点
// GET /api/v1/alerts/stream — 持续推送新告警事件

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { alertBus, type AlertEvent } from '../events.js';

export function registerAlertsStreamRoute(app: FastifyInstance) {
  app.get(
    '/api/v1/alerts/stream',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // SSE 响应头
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no', // 禁用 Nginx/Railway 代理缓冲
      });

      // 发送初始心跳确认连接建立
      reply.raw.write(': connected\n\n');

      // 监听新告警事件
      function onAlert(data: AlertEvent) {
        reply.raw.write(`event: alert\ndata: ${JSON.stringify(data)}\n\n`);
      }

      alertBus.on('alert', onAlert);

      // 心跳保活（每 30 秒）
      const heartbeat = setInterval(() => {
        reply.raw.write(': heartbeat\n\n');
      }, 30_000);

      // 客户端断开连接时清理
      request.raw.on('close', () => {
        alertBus.off('alert', onAlert);
        clearInterval(heartbeat);
      });

      // 不要让 Fastify 自动关闭响应
      await reply.hijack();
    },
  );
}
