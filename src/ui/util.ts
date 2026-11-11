/** 界面层小工具（这里允许用 Date——domain 才有纯净性要求） */

export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

let seq = 0;
export function newId(prefix: string): string {
  seq = (seq + 1) % 1000;
  return `${prefix}${Date.now().toString(36)}${seq}`;
}

/** 'YYYY-MM-DD' → 'X月X日' */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  if (!m || !d) return date;
  return `${Number(m)}月${Number(d)}日`;
}

/** 'YYYY-MM-DD' ± n 天 */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
