/**
 * Basic認証ミドルウェア
 * 環境変数 WEBSSH_USER / WEBSSH_PASS で認証情報を設定する。
 */

const REALM = 'WebSSH';

export function basicAuth(req, res, next) {
  const user = process.env.WEBSSH_USER;
  const pass = process.env.WEBSSH_PASS;

  if (!user || !pass) {
    console.warn('WEBSSH_USER/WEBSSH_PASS not set — auth disabled');
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
  const user = process.env.WEBSSH_USER;
  const pass = process.env.WEBSSH_PASS;

  if (!user || !pass) return true;

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) return false;

  const credentials = Buffer.from(header.slice(6), 'base64').toString();
  const [reqUser, reqPass] = credentials.split(':');

  return reqUser === user && reqPass === pass;
}
