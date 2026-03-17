import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const HOSTS_FILE = join(DATA_DIR, 'hosts.json');
const AUTH_TYPES = new Set(['password', 'key']);

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

function normalizeRequiredString(field, value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} is required`);
  }
  return value.trim();
}

function normalizeOptionalString(field, value) {
  if (value === undefined) return undefined;
  return normalizeRequiredString(field, value);
}

function normalizePort(value, fallback) {
  if (value === undefined) return fallback;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ValidationError('port must be an integer between 1 and 65535');
  }
  return port;
}

function normalizeAuthType(value, fallback) {
  if (value === undefined) {
    if (fallback !== undefined) return fallback;
    throw new ValidationError('authType is required');
  }
  if (!AUTH_TYPES.has(value)) {
    throw new ValidationError('authType must be password or key');
  }
  return value;
}

function ensureAuthSecret(authType, host) {
  if (authType === 'password') {
    delete host.keyPath;
    if (!host.password) {
      throw new ValidationError('password is required for password auth');
    }
    return;
  }

  delete host.password;
  if (!host.keyPath) {
    throw new ValidationError('keyPath is required for key auth');
  }
}

export function buildNewHost(payload) {
  const authType = normalizeAuthType(payload.authType);
  const host = {
    id: randomUUID(),
    name: normalizeRequiredString('name', payload.name),
    host: normalizeRequiredString('host', payload.host),
    port: normalizePort(payload.port, 22),
    username: normalizeRequiredString('username', payload.username),
    authType,
  };

  if (authType === 'password') {
    host.password = normalizeRequiredString('password', payload.password);
  } else {
    host.keyPath = normalizeRequiredString('keyPath', payload.keyPath);
  }

  return host;
}

export function applyHostUpdates(currentHost, updates) {
  const nextHost = { ...currentHost };
  const nextAuthType = normalizeAuthType(updates.authType, currentHost.authType);

  if (updates.name !== undefined) nextHost.name = normalizeOptionalString('name', updates.name);
  if (updates.host !== undefined) nextHost.host = normalizeOptionalString('host', updates.host);
  if (updates.port !== undefined) nextHost.port = normalizePort(updates.port);
  if (updates.username !== undefined) nextHost.username = normalizeOptionalString('username', updates.username);

  nextHost.authType = nextAuthType;

  if (nextAuthType === 'password') {
    if (updates.password !== undefined) {
      nextHost.password = normalizeRequiredString('password', updates.password);
    }
  } else if (updates.keyPath !== undefined) {
    nextHost.keyPath = normalizeRequiredString('keyPath', updates.keyPath);
  }

  ensureAuthSecret(nextAuthType, nextHost);
  return nextHost;
}

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function readHosts() {
  await ensureDataDir();
  if (!existsSync(HOSTS_FILE)) {
    await writeFile(HOSTS_FILE, '[]', 'utf-8');
    return [];
  }
  const data = await readFile(HOSTS_FILE, 'utf-8');
  return JSON.parse(data);
}

async function writeHosts(hosts) {
  await ensureDataDir();
  await writeFile(HOSTS_FILE, JSON.stringify(hosts, null, 2), 'utf-8');
}

/**
 * レスポンス用にパスワードを除外したホストオブジェクトを返す
 */
function sanitize(host) {
  const { password, ...safe } = host;
  return safe;
}

/**
 * Express ルーターを設定する
 */
export function setupHostRoutes(app) {
  // GET /api/hosts — 一覧取得
  app.get('/api/hosts', async (req, res) => {
    try {
      const hosts = await readHosts();
      res.json(hosts.map(sanitize));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hosts — 新規作成
  app.post('/api/hosts', async (req, res) => {
    try {
      const newHost = buildNewHost(req.body);

      const hosts = await readHosts();
      hosts.push(newHost);
      await writeHosts(hosts);

      res.status(201).json(sanitize(newHost));
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/hosts/:id — 更新
  app.put('/api/hosts/:id', async (req, res) => {
    try {
      const hosts = await readHosts();
      const idx = hosts.findIndex(h => h.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Host not found' });
      }

      const host = applyHostUpdates(hosts[idx], req.body);
      hosts[idx] = host;
      await writeHosts(hosts);

      res.json(sanitize(host));
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/hosts/:id — 削除
  app.delete('/api/hosts/:id', async (req, res) => {
    try {
      const hosts = await readHosts();
      const idx = hosts.findIndex(h => h.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Host not found' });
      }

      hosts.splice(idx, 1);
      await writeHosts(hosts);

      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

/**
 * IDでホスト情報を取得する（SSH接続用、パスワード含む）
 */
export async function getHostById(id) {
  const hosts = await readHosts();
  return hosts.find(h => h.id === id) || null;
}
