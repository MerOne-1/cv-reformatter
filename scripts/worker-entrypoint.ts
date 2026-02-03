import 'dotenv/config';
import http from 'http';
import {
  startAgentWorker,
  stopAgentWorker,
  startOrchestratorWorker,
  stopOrchestratorWorker,
  startAudioTranscriptionWorker,
  stopAudioTranscriptionWorker,
  getAgentQueueEvents,
  getOrchestratorQueueEvents,
  closeQueueEvents,
  closeRedisConnection,
} from '../lib/queue';

const PORT = parseInt(process.env.PORT || '3001', 10);

let isShuttingDown = false;
let isHealthy = true;

async function startWorkers() {
  console.log('Starting CV Workflow Workers...');
  console.log(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
  console.log(`Concurrency: ${process.env.WORKER_CONCURRENCY || 5}`);

  try {
    startAgentWorker();
    console.log('✓ Agent worker started');

    startOrchestratorWorker();
    console.log('✓ Orchestrator worker started');

    startAudioTranscriptionWorker();
    console.log('✓ Audio transcription worker started');

    getAgentQueueEvents();
    console.log('✓ Agent queue events listener started');

    getOrchestratorQueueEvents();
    console.log('✓ Orchestrator queue events listener started');

    isHealthy = true;
    console.log('All workers started successfully');
  } catch (error) {
    console.error('Failed to start workers:', error);
    isHealthy = false;
    process.exit(1);
  }
}

async function stopWorkers() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('Stopping workers gracefully...');

  try {
    await stopAgentWorker();
    console.log('✓ Agent worker stopped');

    await stopOrchestratorWorker();
    console.log('✓ Orchestrator worker stopped');

    await stopAudioTranscriptionWorker();
    console.log('✓ Audio transcription worker stopped');

    await closeQueueEvents();
    console.log('✓ Queue events closed');

    await closeRedisConnection();
    console.log('✓ Redis connection closed');

    console.log('All workers stopped gracefully');
  } catch (error) {
    console.error('Error stopping workers:', error);
  }
}

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    if (isHealthy && !isShuttingDown) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
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
  await stopWorkers();
  healthServer.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT signal');
  await stopWorkers();
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

healthServer.listen(PORT, () => {
  console.log(`Health server listening on port ${PORT}`);
  startWorkers();
});
