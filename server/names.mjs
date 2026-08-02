// 表示名の決め方を1箇所に集約する。
// 工場名は DB(factories.name) に必ず入っている前提にしたいので、
// 「既定名の作り方」はアカウント作成(auth.mjs)と API(api.mjs)で同じものを使う。

/** ユーザーの表示名。users.name → 無ければメールアドレスの @ より前 */
export const displayName = (u) =>
  String(u?.name || '').trim() || String(u?.email || '').split('@')[0] || 'ゲスト';

/** 工場名の既定値。アカウント作成時にこの値を factories.name に入れる */
export const defaultFactoryName = (u) => `${displayName(u)}の工場`;

/** 工場名の正規化。空にされたら既定名に戻す（名前なしの工場は作らない） */
export const normalizeFactoryName = (raw, user) =>
  String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 24) || defaultFactoryName(user);
