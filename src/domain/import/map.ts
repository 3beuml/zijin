/**
 * map：结构草图 + 模板库 → 列到语义的映射建议。
 * 模板优先，启发式兜底。纯函数。
 */
import type {
  Cell,
  ColumnSketch,
  ImportMapping,
  ImportTemplate,
  MappingColumn,
  StructureSketch,
} from './types.ts';

export interface MapOptions {
  defaultExamLabel?: string; // 本次考试的默认名（如「期中」）
}

/** 列的表头全文（各表头行自底向上拼接），用于模板匹配 */
function headerFull(table: Cell[][], colIdx: number, headerRows: number): string {
  const parts: string[] = [];
  for (let r = 0; r < headerRows; r++) {
    const v = table[r]?.[colIdx];
    const t = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
    if (t) parts.push(t);
  }
  return parts.join(' ');
}

/** 模板匹配：表头全文序列 + 表头行数都一致才算命中 */
function matchTemplate(
  table: Cell[][],
  sketch: StructureSketch,
  templates: ImportTemplate[],
): ImportTemplate | null {
  for (const t of templates) {
    if (t.match.headerRows !== sketch.headerRows) continue;
    if (t.match.columns.length !== sketch.columns.length) continue;
    let ok = true;
    for (let i = 0; i < t.match.columns.length; i++) {
      const want = t.match.columns[i].trim();
      const got = headerFull(table, i, sketch.headerRows).trim();
      if (want !== got) { ok = false; break; }
    }
    if (ok) return t;
  }
  return null;
}

/** 兜底：找一列「多数为文本、基本唯一」的数据列当姓名列。
 *  学号/考号这类全数字列唯一率同样高，会被误选——数字占比过高的列直接排除。 */
function guessNameColumn(table: Cell[][], sketch: StructureSketch): ColumnSketch | null {
  const start = sketch.dataStartRow - 1;
  const end = sketch.dataEndRow - 1;
  let best: { index: number; score: number } | null = null;
  for (const col of sketch.columns) {
    if (col.role !== 'unknown' && col.role !== 'student.name') continue;
    const vals: string[] = [];
    let nonNull = 0;
    for (let r = start; r <= end; r++) {
      const v = table[r]?.[col.index - 1];
      const t = typeof v === 'string' ? v.trim() : '';
      if (!t) continue;
      nonNull++;
      vals.push(t);
    }
    if (nonNull < 3) continue;
    const numericRatio = vals.filter((t) => /^-?\d+(\.\d+)?$/.test(t)).length / vals.length;
    if (numericRatio > 0.6) continue; // 学号/考号，不是姓名
    const unique = new Set(vals).size;
    const textRatio = nonNull / Math.max(1, end - start + 1);
    const uniqueness = unique / nonNull;
    const score = textRatio * 0.4 + uniqueness * 0.6;
    if (!best || score > best.score) best = { index: col.index, score };
  }
  if (!best || best.score < 0.5) return null;
  const col = sketch.columns.find((c) => c.index === best.index)!;
  return col;
}

export function map(
  table: Cell[][],
  sketch: StructureSketch,
  templates: ImportTemplate[] = [],
  options: MapOptions = {},
): ImportMapping {
  const warnings: string[] = [];
  const matched = matchTemplate(table, sketch, templates);
  let columns: MappingColumn[];

  if (matched) {
    columns = sketch.columns.map((col) => {
      const m = matched.mapping.find((x) => x.col === col.index);
      if (!m) {
        return { ...col, header: col.header, source: 'template' as const, confidence: 0.2 };
      }
      return {
        index: col.index,
        header: col.header,
        role: m.role,
        subject: m.subject,
        attempt: m.attempt,
        poolScope: m.poolScope,
        confidence: 1,
        source: 'template' as const,
      };
    });
  } else {
    columns = sketch.columns.map((col) => ({ ...col, source: 'sketch' as const }));
    // 低置信度提醒
    const low = columns.filter((c) => c.confidence < 0.7 && c.role !== 'unknown');
    if (low.length) {
      warnings.push(
        `低置信度列需要确认：${low.map((c) => `列${c.index}「${c.header}」`).join('、')}`,
      );
    }
  }

  // 姓名列缺失 → 兜底猜测
  if (!columns.some((c) => c.role === 'student.name')) {
    const guess = guessNameColumn(table, sketch);
    if (guess) {
      const target = columns.find((c) => c.index === guess.index)!;
      target.role = 'student.name';
      target.confidence = 0.3;
      target.source = 'fallback';
      warnings.push(`已猜测列 ${guess.index} 为姓名列（表头为空），请在确认步骤核对`);
    }
  }

  // 考试命名：标题行带「期中/月考/期末」优先
  let label = options.defaultExamLabel;
  if (!label && sketch.titleText) {
    const m = sketch.titleText.match(/(期中|期末|月考|开学考|模拟)/);
    if (m) label = m[1];
  }
  const examLabels: Record<number, string> = { 1: '上次', 2: label ?? '本次' };
  // 标题里的次别提示（如「第一次月考」）
  if (sketch.titleText) {
    const m = sketch.titleText.match(/第\s*([一二三四五1-9])\s*次/);
    if (m) examLabels[2] = `第${m[1]}次${label ?? '考试'}`;
  }

  return {
    headerRows: sketch.headerRows,
    dataStartRow: sketch.dataStartRow,
    dataEndRow: sketch.dataEndRow,
    columns,
    examLabels,
    warnings: [...sketch.warnings, ...warnings],
    matchedTemplate: matched ? matched.name : null,
  };
}
