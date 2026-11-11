/**
 * 基建：xlsx → Cell[][]（第一维是行）。
 * 归一化：公式取 result；富文本拼接；日期转 'YYYY-MM-DD'；空串归 null。
 * 这一层是唯一的 IO 边界，detect/map/commit 不碰它。
 */
import ExcelJS from 'exceljs';

function normValue(v) {
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
    if (Array.isArray(v.richText)) return normValue(v.richText.map((t) => t.text).join(''));
    if ('result' in v) return normValue(v.result ?? null);
    if ('text' in v) return normValue(v.text);
    if ('error' in v) return null;
    return null;
  }
  return null;
}

export async function readTable(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  if (!ws) return { table: [], sheetName: '' };
  const table = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = [];
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
