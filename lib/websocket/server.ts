import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
// @ts-expect-error - y-websocket/bin/utils has no type declarations
import { setupWSConnection } from 'y-websocket/bin/utils';
import { getPersistence } from './persistence';

let wss: WebSocketServer | null = null;
let httpServer: http.Server | null = null;

export interface WebSocketServerOptions {
  port: number;
  host?: string;
}

export function startWebSocketServer(options: WebSocketServerOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const { port, host = '0.0.0.0' } = options;

    httpServer = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', connections: wss?.clients.size ?? 0 }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    wss = new WebSocketServer({ server: httpServer });

    const persistence = getPersistence();

    wss.on('connection', (conn: WebSocket, req: http.IncomingMessage) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const docName = url.pathname.slice(1) || 'default';

      console.log(`[WebSocket] Client connected to document: ${docName}`);

      setupWSConnection(conn, req, {
        docName,
        gc: true,
        persistence,
      });
    });

    wss.on('error', (error: Error) => {
      console.error('[WebSocket] Server error:', error);
      reject(error);
    });

    httpServer.listen(port, host, () => {
      console.log(`✓ WebSocket server running on ws://${host}:${port}`);
      resolve();
    });

    httpServer.on('error', (error) => {
      console.error('[WebSocket] HTTP server error:', error);
      reject(error);
    });
  });
}

export async function stopWebSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    if (wss) {
      wss.clients.forEach((client: WebSocket) => {
        client.close();
      });
      wss.close(() => {
        console.log('WebSocket server closed');
        wss = null;
      });
    }

    if (httpServer) {
      httpServer.close(() => {
        console.log('HTTP server closed');
        httpServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export function getConnectionCount(): number {
  return wss?.clients.size ?? 0;
}
