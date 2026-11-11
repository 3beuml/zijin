/**
 * xlsx → Cell[][]（同构：Node 与浏览器共用）。
 * 归一化：公式取 result；富文本拼接；日期转 'YYYY-MM-DD'；空串归 null。
 * 这是唯一的表格 IO 归一化边界，detect/map/commit 不碰它。
 */
import ExcelJS from 'exceljs';
import type { Cell } from '../domain/import/types.ts';

function normValue(v: unknown): Cell {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return normValue(o.richText.map((t) => (t as { text: string }).text).join(''));
    if ('result' in o) return normValue(o.result ?? null);
    if ('text' in o) return normValue(o.text);
    return null; // 错误格（#DIV/0! 等）按空处理
  }
  return null;
}

export async function tableFromBuffer(
  buf: ArrayBuffer,
): Promise<{ table: Cell[][]; sheetName: string }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return { table: [], sheetName: '' };
  const table: Cell[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row: Cell[] = [];
    let any = false;
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = normValue(ws.getRow(r).getCell(c).value);
      row.push(v);
      if (v != null) any = true;
    }
    table.push(any ? row : []);
  }
  // 去掉末尾整行空白
  while (table.length && table[table.length - 1].length === 0) table.pop();
  return { table, sheetName: ws.name ?? '' };
}
