import http from 'http';
import { startWebSocketServer, stopWebSocketServer, getConnectionCount } from '../lib/websocket/server';
import { closeRedisConnection } from '../lib/queue/connection';

const WEBSOCKET_PORT = parseInt(process.env.WEBSOCKET_PORT || '1234', 10);
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '3002', 10);

let isShuttingDown = false;
let isHealthy = false;

async function start() {
  console.log('Starting WebSocket Collaboration Server...');
  console.log(`WebSocket Port: ${WEBSOCKET_PORT}`);
  console.log(`Health Port: ${HEALTH_PORT}`);
  console.log(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);

  try {
    await startWebSocketServer({ port: WEBSOCKET_PORT });
    isHealthy = true;
    console.log('WebSocket server started successfully');
  } catch (error) {
    console.error('Failed to start WebSocket server:', error);
    isHealthy = false;
    process.exit(1);
  }
}

async function stop() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('Stopping WebSocket server gracefully...');

  try {
    await stopWebSocketServer();
    console.log('✓ WebSocket server stopped');

    await closeRedisConnection();
    console.log('✓ Redis connection closed');

    console.log('WebSocket server stopped gracefully');
  } catch (error) {
    console.error('Error stopping WebSocket server:', error);
  }
}

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    if (isHealthy && !isShuttingDown) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        connections: getConnectionCount(),
        timestamp: new Date().toISOString(),
      }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'unhealthy', shutting_down: isShuttingDown }));
    }
  } else if (req.url === '/ready' && req.method === 'GET') {
    if (isHealthy && !isShuttingDown) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready' }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'not_ready' }));
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM signal');
  await stop();
  healthServer.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT signal');
  await stop();
  healthServer.close();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  isHealthy = false;
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

healthServer.listen(HEALTH_PORT, () => {
  console.log(`Health server listening on port ${HEALTH_PORT}`);
  start();
});
