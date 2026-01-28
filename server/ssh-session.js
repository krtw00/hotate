import { Client } from 'ssh2';
import { readFile } from 'node:fs/promises';
import { getHostById } from './config.js';

/**
 * WebSocket接続に対してSSHセッションを確立し、双方向ブリッジを行う。
 *
 * メッセージ形式:
 *   Client→Server: { type: "input", payload: "<base64>" }
 *                   { type: "resize", payload: { cols, rows } }
 *   Server→Client: { type: "output", payload: "<base64>" }
 *                   { type: "connected", payload: { host, port } }
 *                   { type: "error", payload: { message } }
 *                   { type: "exit", payload: { code } }
 */
export async function handleSSHSession(ws, hostId) {
  const hostInfo = await getHostById(hostId);
  if (!hostInfo) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Host not found' } }));
    ws.close();
    return;
  }

  const conn = new Client();
  let stream = null;

  conn.on('ready', () => {
    conn.shell({ term: 'xterm-256color' }, (err, sh) => {
      if (err) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: err.message } }));
        conn.end();
        return;
      }

      stream = sh;

      ws.send(JSON.stringify({
        type: 'connected',
        payload: { host: hostInfo.host, port: hostInfo.port },
      }));

      // SSH stdout → WebSocket (Base64)
      stream.on('data', (data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'output',
            payload: data.toString('base64'),
          }));
        }
      });

      stream.stderr.on('data', (data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'output',
            payload: data.toString('base64'),
          }));
        }
      });

      stream.on('close', (code) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'exit', payload: { code: code || 0 } }));
        }
        conn.end();
      });
    });
  });

  conn.on('error', (err) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: err.message } }));
    }
    ws.close();
  });

  // WebSocket → SSH
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'input' && stream) {
        const decoded = Buffer.from(msg.payload, 'base64');
        stream.write(decoded);
      } else if (msg.type === 'resize' && stream) {
        const { cols, rows } = msg.payload;
        stream.setWindow(rows, cols, 0, 0);
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    if (stream) stream.close();
    conn.end();
  });

  // SSH接続を開始
  const connectConfig = {
    host: hostInfo.host,
    port: hostInfo.port,
    username: hostInfo.username,
    readyTimeout: 10000,
  };

  if (hostInfo.authType === 'key') {
    try {
      const keyPath = hostInfo.keyPath.replace(/^~/, process.env.HOME || process.env.USERPROFILE);
      connectConfig.privateKey = await readFile(keyPath);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: `Key file error: ${err.message}` } }));
      ws.close();
      return;
    }
  } else {
    connectConfig.password = hostInfo.password;
  }

  conn.connect(connectConfig);
}
