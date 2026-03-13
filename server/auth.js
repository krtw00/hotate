/**
 * Basic認証ミドルウェア
 * 環境変数 HOTATE_USER / HOTATE_PASS で認証情報を設定する。
 */

const REALM = 'Hotate';

// SW/PWA files must be accessible without auth
// (Service Worker fetch calls don't carry Basic Auth credentials)
const AUTH_EXEMPT = ['/sw.js', '/manifest.json'];

export function basicAuth(req, res, next) {
  const user = process.env.HOTATE_USER;
  const pass = process.env.HOTATE_PASS;

  if (!user || !pass) {
    console.warn('HOTATE_USER/HOTATE_PASS not set — auth disabled');
    return next();
  }

  if (AUTH_EXEMPT.includes(req.path) || req.path.startsWith('/.well-known/')) {
    return next();
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', `Basic realm="${REALM}"`);
    return res.status(401).send('Authentication required');
  }

  const credentials = Buffer.from(header.slice(6), 'base64').toString();
  const [reqUser, reqPass] = credentials.split(':');

  if (reqUser === user && reqPass === pass) {
    return next();
  }

  res.set('WWW-Authenticate', `Basic realm="${REALM}"`);
  return res.status(401).send('Invalid credentials');
}

/**
 * WebSocketアップグレード時のBasic認証チェック
 */
export function authenticateUpgrade(req) {
  const user = process.env.HOTATE_USER;
  const pass = process.env.HOTATE_PASS;

  if (!user || !pass) return true;

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) return false;

  const credentials = Buffer.from(header.slice(6), 'base64').toString();
  const [reqUser, reqPass] = credentials.split(':');

  return reqUser === user && reqPass === pass;
}
