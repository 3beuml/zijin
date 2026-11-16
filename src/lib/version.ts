/**
 * 版本比较：把 'v1.0.3' 与 '1.0.2' 这类版本号拆成数字段逐段比较。
 * 前缀 'v' 可有可无；段数不一致时缺段按 0 处理（1.0 与 1.0.0 相等）。
 * 解析失败的段按 0 计——版本号只在自家 Release 流程里产生，不会出现奇怪形态。
 */

export function parseVersion(v: string): number[] {
  const m = String(v ?? '')
    .trim()
    .replace(/^v/i, '')
    .match(/\d+(\.\d+)*$/);
  if (!m) return [];
  return m[0].split('.').map((n) => Number(n) || 0);
}

/** latest 是否比 current 新 */
export function isNewerVersion(current: string, latest: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(latest);
  if (a.length === 0 || b.length === 0) return false; // 解析不出就不乱报
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (bv > av) return true;
    if (bv < av) return false;
  }
  return false;
}
