// 認証とユーザー紐づけ。
//
//   ブラウザ側: Google SSO（本番）/ dev ログイン（ローカル）→ Cookie セッション
//   Claude Code 側: 人ごとの取り込みトークン → user_id
//
// ★ 重要な原則:
//   OTLP ペイロードの user.email はクライアントの自己申告なので、集計のキーにしない。
//   キーは必ずトークンから引いた user_id にする。食い違いは identity_mismatches に残す。
import crypto from 'node:crypto';
import { q, one, tx } from './db.mjs';

const DAY = 86400e3;
export const SESSION_TTL_MS = 30 * DAY;

/** Google OIDC。未設定ならローカルの dev ログインだけが有効になる */
export const google = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  // 社内ドメイン限定。空なら制限なし
  hd: process.env.GOOGLE_HD || '',
  get enabled() { return !!(this.clientId && this.clientSecret); },
};
/** ローカル検証用のログイン。本番では必ず false にする */
export const DEV_LOGIN = process.env.DEV_LOGIN !== '0' && !google.enabled;

const rnd = (n = 32) => crypto.randomBytes(n).toString('base64url');

/* ============================ ユーザー ============================ */
export async function upsertUser({ email, googleSub = null, name = '' }) {
  const mail = String(email || '').toLowerCase().trim();
  if (!mail || !mail.includes('@')) throw new Error('メールアドレスが不正です');
  return tx(async (c) => {
    const u = (await c.query(
      `INSERT INTO users(email, google_sub, name) VALUES ($1,$2,$3)
       ON CONFLICT (email) DO UPDATE
         SET google_sub = COALESCE(EXCLUDED.google_sub, users.google_sub),
             name       = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE users.name END
       RETURNING *`,
      [mail, googleSub, name])).rows[0];
    // 工場を1つ持たせる（最初の1台＝2マス機は在庫に入れておく）
    await c.query(
      `INSERT INTO factories(user_id, stock)
       VALUES ($1, '{"machine":{"s2":1},"prop":{},"deco":{}}'::jsonb)
       ON CONFLICT (user_id) DO NOTHING`, [u.id]);
    return u;
  });
}

/* ======================= ブラウザのセッション ======================= */
export async function createSession(userId) {
  const token = rnd();
  await q(`INSERT INTO auth_sessions(token, user_id, expires_at) VALUES ($1,$2,now()+$3::interval)`,
    [token, userId, `${Math.round(SESSION_TTL_MS / 1000)} seconds`]);
  return token;
}

export async function userFromSession(token) {
  if (!token) return null;
  return one(
    `SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token=$1 AND s.expires_at > now()`, [token]);
}

export const destroySession = (token) =>
  q(`DELETE FROM auth_sessions WHERE token=$1`, [token]);

/* ==================== Claude Code の取り込みトークン ==================== */
/** その人の有効なトークンを返す。無ければ発行する */
export async function ensureIngestToken(userId) {
  const cur = await one(
    `SELECT token FROM ingest_tokens WHERE user_id=$1 AND revoked_at IS NULL
      ORDER BY created_at DESC LIMIT 1`, [userId]);
  if (cur) return cur.token;
  const token = 'cf_' + rnd(24);
  await q(`INSERT INTO ingest_tokens(token, user_id) VALUES ($1,$2)`, [token, userId]);
  return token;
}

export async function rotateIngestToken(userId) {
  await q(`UPDATE ingest_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`,
    [userId]);
  return ensureIngestToken(userId);
}

/** Authorization: Bearer <token> / x-factory-token から user を引く */
export async function userFromIngest(req) {
  const h = req.headers['authorization'] || '';
  const bearer = /^bearer\s+(.+)$/i.exec(h)?.[1];
  const token = (bearer || req.headers['x-factory-token'] || '').trim();
  if (!token) return null;
  const u = await one(
    `SELECT u.* FROM ingest_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token=$1 AND t.revoked_at IS NULL`, [token]);
  if (u) q(`UPDATE ingest_tokens SET last_seen_at=now() WHERE token=$1`, [token]).catch(() => {});
  return u;
}

/**
 * ペイロードが名乗る user.email が本人と一致するかを見る。
 * 一致しなくても取り込みは続ける（トークンの持ち主に付ける）が、記録は残す。
 */
export function makeAuditor(user) {
  let logged = false;
  return (attrs) => {
    const claimed = String(attrs?.['user.email'] || '').toLowerCase();
    if (!claimed || logged) return;
    if (claimed !== String(user.email).toLowerCase()) {
      logged = true;
      q(`INSERT INTO identity_mismatches(user_id, claimed) VALUES ($1,$2)`, [user.id, claimed])
        .catch(() => {});
      console.warn(`  [auth] 名乗りの不一致: token=${user.email} / payload=${claimed}`);
    }
  };
}

/* ============================ Google OIDC ============================ */
export function googleAuthUrl(redirectUri, state) {
  const p = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  if (google.hd) p.set('hd', google.hd);          // 社内ドメインのアカウントだけ出す
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/**
 * 認可コードを ID トークンに交換する。
 * 交換は Google と TLS で直接行うので、この経路で得た id_token は信頼できる
 * （Authorization Code Flow）。フロント経由で受け取った id_token を信じる場合は
 * JWKS による署名検証が別途必須になる。
 */
export async function googleExchange(code, redirectUri) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: google.clientId, client_secret: google.clientSecret,
      redirect_uri: redirectUri, grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google トークン交換に失敗: ${res.status} ${await res.text()}`);
  const { id_token } = await res.json();
  if (!id_token) throw new Error('id_token が返ってきませんでした');
  const claims = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64url').toString('utf8'));
  if (!claims.email_verified) throw new Error('メールアドレスが未検証のアカウントです');
  if (google.hd && claims.hd !== google.hd) throw new Error(`${google.hd} のアカウントで入ってください`);
  return { email: claims.email, googleSub: claims.sub, name: claims.name || '' };
}

/* ============================== Cookie ============================== */
export const COOKIE = 'cf_session';
export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
export const setCookie = (token, secure) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}` +
  (secure ? '; Secure' : '');
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
