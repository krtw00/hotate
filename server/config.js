import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const HOSTS_FILE = join(DATA_DIR, 'hosts.json');

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
      const { name, host, port = 22, username, authType, password, keyPath } = req.body;

      if (!name || !host || !username || !authType) {
        return res.status(400).json({ error: 'name, host, username, authType are required' });
      }
      if (authType === 'password' && !password) {
        return res.status(400).json({ error: 'password is required for password auth' });
      }
      if (authType === 'key' && !keyPath) {
        return res.status(400).json({ error: 'keyPath is required for key auth' });
      }

      const newHost = {
        id: randomUUID(),
        name,
        host,
        port: Number(port),
        username,
        authType,
        ...(authType === 'password' ? { password } : { keyPath }),
      };

      const hosts = await readHosts();
      hosts.push(newHost);
      await writeHosts(hosts);

      res.status(201).json(sanitize(newHost));
    } catch (err) {
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

      const updates = req.body;
      const host = hosts[idx];

      if (updates.name !== undefined) host.name = updates.name;
      if (updates.host !== undefined) host.host = updates.host;
      if (updates.port !== undefined) host.port = Number(updates.port);
      if (updates.username !== undefined) host.username = updates.username;
      if (updates.authType !== undefined) {
        host.authType = updates.authType;
        if (updates.authType === 'password') {
          delete host.keyPath;
          if (updates.password) host.password = updates.password;
        } else {
          delete host.password;
          if (updates.keyPath) host.keyPath = updates.keyPath;
        }
      } else {
        if (updates.password !== undefined) host.password = updates.password;
        if (updates.keyPath !== undefined) host.keyPath = updates.keyPath;
      }

      hosts[idx] = host;
      await writeHosts(hosts);

      res.json(sanitize(host));
    } catch (err) {
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
