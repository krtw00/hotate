import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { basicAuth, authenticateUpgrade } from './auth.js';
import { setupHostRoutes } from './config.js';
import { handleSSHSession } from './ssh-session.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
const server = createServer(app);

// Middleware
app.use(basicAuth);
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

// REST API
setupHostRoutes(app);

// WebSocket
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (!authenticateUpgrade(req)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const hostId = url.searchParams.get('hostId');

  if (!hostId) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'hostId is required' } }));
    ws.close();
    return;
  }

  handleSSHSession(ws, hostId);
});

server.listen(PORT, () => {
  console.log(`WebSSH listening on http://localhost:${PORT}`);
});
