/**
 * Excel 导出（周手册登记表）。exceljs 写 xlsx → Blob → 分享/下载。
 */
import ExcelJS from 'exceljs';
import type { WeekRow } from '../domain/weekly.ts';
import { fmtScore } from '../domain/format.ts';
import { downloadBlob } from './print.ts';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function colCount(row: WeekRow, types: string[], key: string): number {
  if (key === '其他') {
    let n = 0;
    for (const [t, c] of row.countByType) if (!types.includes(t)) n += c;
    return n;
  }
  return row.countByType.get(key) ?? 0;
}

export async function buildRegisterWorkbook(
  rows: WeekRow[],
  meta: { range: string; title: string; nextWeek: { due: string; title: string; student?: string }[] },
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '子衿';
  const ws = wb.addWorksheet('周手册');

  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `${meta.title}（${meta.range}）`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  const types = ['沟通', '谈心', '家访'];
  const header = ['学生', ...types, '其他', '最近成绩', '本周摘要'];
  const headRow = ws.addRow(header);
  headRow.font = { bold: true };
  headRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EBF0' } };
    cell.border = { bottom: { style: 'thin' } };
  });

  for (const row of rows) {
    const lastScore =
      row.total == null
        ? '—'
        : `${fmtScore(row.total)}${row.rank != null ? `（${row.poolLabel}第 ${row.rank} 名）` : ''}`;
    const r = ws.addRow([
      row.student.name,
      colCount(row, types, '沟通') || null,
      colCount(row, types, '谈心') || null,
      colCount(row, types, '家访') || null,
      colCount(row, types, '其他') || null,
      lastScore,
      row.summary || '本周无记录',
    ]);
    r.border = { bottom: { style: 'hair' } };
    if (row.count === 0) {
      r.eachCell((cell) => {
        const c = Number(cell.col);
        if (c >= 2 && c <= 5) cell.font = { color: { argb: 'FFB4731F' } };
      });
    }
  }

  ws.columns.forEach((col, i) => {
    col.width = i === 6 ? 42 : i === 0 ? 10 : i === 5 ? 20 : 8;
  });

  if (meta.nextWeek.length) {
    ws.addRow([]);
    const nw = ws.addRow(['下周重点', '', '', '', '', '', '']);
    nw.font = { bold: true };
    for (const t of meta.nextWeek.slice(0, 10)) {
      ws.addRow([`${t.due} ${t.title}${t.student ? `（${t.student}）` : ''}`, '', '', '', '', '', '']);
    }
  }
  ws.addRow([]);
  ws.addRow(['由子衿本地生成 · 数据不出本机']).font = { color: { argb: 'FF8C9196' }, size: 9 };

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

/** 生成并触发下载/分享 */
export async function exportRegisterExcel(
  rows: WeekRow[],
  meta: { range: string; title: string; fileName: string; nextWeek: { due: string; title: string; student?: string }[] },
): Promise<void> {
  const buf = await buildRegisterWorkbook(rows, meta);
  const blob = new Blob([buf], { type: XLSX_MIME });
  const file = new File([blob], meta.fileName, { type: XLSX_MIME });
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
    share?: (d: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: meta.fileName });
      return;
    } catch {
      // 用户取消 → 落回下载
    }
  }
  downloadBlob(blob, meta.fileName);
}
