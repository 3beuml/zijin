/** 展示格式化：分数、浮动、名次差值的文本化 */

/** 98 → '98'，63.5 → '63.5'，null → '—'；最多一位小数 */
export function fmtScore(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return String(Math.round(n * 10) / 10);
}

/** 浮动文本：正数进步带 +，负数退步带 −（全角减号更醒目），不可比给 '—' */
export function fmtDelta(delta: number | null | undefined, comparable: boolean): string {
  if (!comparable || delta == null) return '—';
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `-${Math.abs(delta)}`;
  return '0';
}
