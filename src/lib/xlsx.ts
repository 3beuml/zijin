/**
 * 表格文件 → Cell[][]（同构：Node CLI 与浏览器共用）。
 * 支持：.xlsx/.xlsm（exceljs）、.csv（内置解析，UTF-8/GBK 自动识别）。
 * .xls（老版二进制格式）给出明确的中文指引，而不是让 exceljs 抛英文堆栈。
 * 归一化：公式取 result；富文本拼接；日期转 'YYYY-MM-DD'；空串归 null。
 * 这是唯一的表格 IO 归一化边界，detect/map/commit 不碰它。
 */
import ExcelJS from 'exceljs';
import type { Cell } from '../domain/import/types.ts';

export interface SheetTable {
  name: string;
  table: Cell[][];
}

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

function sheetToTable(ws: ExcelJS.Worksheet): Cell[][] {
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
  return table;
}

/** 文件头嗅探：zip（xlsx）开头是 PK，老版 .xls（OLE2）是 D0 CF 11 E0，其余当文本 */
function detectMagic(buf: ArrayBuffer): 'zip' | 'ole' | 'text' {
  const b = new Uint8Array(buf.slice(0, 8));
  if (b[0] === 0x50 && b[1] === 0x4b) return 'zip';
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'ole';
  return 'text';
}

/** UTF-8 优先；出现乱码符再用 GBK 解（学校导出文件常见的 ANSI 编码） */
function decodeText(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('\uFFFD')) return utf8.replace(/^\uFEFF/, '');
  try {
    return new TextDecoder('gbk').decode(buf).replace(/^\uFEFF/, '');
  } catch {
    return utf8.replace(/^\uFEFF/, '');
  }
}

/**
 * CSV → Cell[][]。引号转义（"" → "）支持；分隔符在 , / ; / \t 里按首行出现次数嗅探。
 * 数字保留字符串形态：detect 的 isNum、commit 的 toNumber 都认文本数字。
 */
export function parseCsvTable(raw: string): Cell[][] {
  const text = raw.replace(/^\uFEFF/, '');
  if (text.trim() === '') return [];
  const firstLineEnd = text.indexOf('\n');
  const head = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const count = (ch: string): number => head.split(ch).length - 1;
  const candidates: [string, number][] = [
    [',', count(',')],
    [';', count(';')],
    ['\t', count('\t')],
  ];
  const delim = candidates.sort((a, b) => b[1] - a[1])[0][0];

  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let cell = '';
  let inQuotes = false;
  const pushCell = (): void => {
    const t = cell.trim();
    row.push(t === '' ? null : t);
    cell = '';
  };
  const pushRow = (): void => {
    pushCell();
    rows.push(row.some((v) => v != null) ? row : []);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delim) { pushCell(); continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { pushRow(); continue; }
    cell += ch;
  }
  if (cell !== '' || row.length > 0) pushRow();
  // 去掉末尾整行空白
  while (rows.length && rows[rows.length - 1].length === 0) rows.pop();
  return rows;
}

/** 解析任意表格文件，返回全部有数据的工作表（多 sheet 时让老师选） */
export async function tablesFromBuffer(buf: ArrayBuffer): Promise<{ sheets: SheetTable[] }> {
  const magic = detectMagic(buf);
  if (magic === 'ole') {
    throw new Error('这是老版 Excel（.xls）格式。请用 Excel / WPS 把它「另存为」.xlsx 再导入。');
  }
  if (magic === 'zip') {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buf);
    } catch {
      throw new Error('文件打不开：可能下载不完整，或不是有效的 Excel（.xlsx）文件。');
    }
    const sheets: SheetTable[] = [];
    for (const ws of wb.worksheets) {
      const table = sheetToTable(ws);
      if (table.length > 0) sheets.push({ name: ws.name ?? '', table });
    }
    return { sheets };
  }
  // 其余按文本（CSV）处理——.xls 变种和损坏文件会在这一步给出可读的错误
  const text = decodeText(buf);
  const table = parseCsvTable(text);
  if (table.length === 0) {
    throw new Error('文件是空的，或不是子衿支持的表格格式（.xlsx / .csv）。');
  }
  return { sheets: [{ name: 'CSV', table }] };
}

/** 兼容旧调用：取第一个有数据的工作表 */
export async function tableFromBuffer(buf: ArrayBuffer): Promise<{ table: Cell[][]; sheetName: string }> {
  const { sheets } = await tablesFromBuffer(buf);
  const first = sheets[0] ?? { name: '', table: [] as Cell[][] };
  return { table: first.table, sheetName: first.name };
}
