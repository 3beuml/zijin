/**
 * detect：表格结构探测器（T1）。纯同步、无 IO。
 * 输入二维数组（第一维是行），输出结构草图。
 * 所有 index 都是 1 起数（与 T1 示例、模板 col 一致）。
 */
import type {
  Cell,
  ColumnSketch,
  DerivedColumn,
  SketchRole,
  StructureSketch,
  SubjectGroup,
} from './types.ts';

/** 已知科目词（够 v0.1 用；不认识的列头会落 unknown 并给低置信度） */
const SUBJECT_WORDS = [
  '语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '科学', '道法',
];

/** 表头词表：判断一行是表头还是「人名 + 缺考」的数据行 */
const HEADER_VOCAB = [
  ...SUBJECT_WORDS,
  '姓名', '名字', '班级', '班别', '导师', '总分', '浮动', '级名', '名次', '排名',
  '班名', '分数', '成绩', '得分', '分层', '层', '学号', '考号', '序号', '号',
  '教师', '老师', '班主任', '任课', '均分', '平均', '性别', '备注', '宿舍', '日期',
];

const SUMMARY_NAME_RE = /^(班级|全班)?\s*(平均|合计|均分|总分|总计|小计)/;

/** 显式缺考标记：这些词出现在分数列里是「缺考」而不是坏数据 */
const ABSENT_MARK_RE = /^(缺考|旷考|旷|病假|事假|免考|休学|请假|未考|—|－|－+|-+|\/)$/;

/** 全角数字/句点 → 半角（「８８」「８８．５」也是数字） */
function halfWidth(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/．/g, '.');
}

/** 裸列归并只认「纯量词表头」：级名/名次/班名/排名/分数/成绩/得分/分层/层 + 可选次别数字。
 *  长表头（如「道德与法治分数」）是未识别科目的独立列，挂到左边科目组会张冠李戴。 */
const BARE_HEADER_RE = /^(级名|名次|班名|排名|分数|成绩|得分|分层|层)\d{0,2}$/;

/** 归一化单元格：字符串去首尾空白；空白串视作 null */
function norm(v: Cell): Cell {
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return v;
}

function isNum(v: Cell): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  // 文本形式的数字（如「88.5」、全角「８８」）也标志着数据行开始
  if (typeof v === 'string') return /^-?\d+(\.\d+)?$/.test(halfWidth(v));
  return false;
}

function nonEmptyCount(row: Cell[]): number {
  return row.filter((c) => norm(c) != null).length;
}

/** 从表头格文本里剥出 (subject, stem, attempt) */
function splitHeader(text: string): { subject?: string; stem: string; attempt?: number } {
  let s = text.trim();
  // 次别后缀：总分1 / 分数2 / 级名1 —— 数字是次别不是层级（4+ 也能剥出，交给警告提示）
  let attempt: number | undefined;
  const m = s.match(/([1-9])$/);
  if (m && s.length > 1 && /[\u4e00-\u9fa5]$/.test(s.slice(0, -1))) {
    attempt = Number(m[1]);
    s = s.slice(0, -1);
  }
  for (const w of SUBJECT_WORDS) {
    if (s.startsWith(w)) return { subject: w, stem: s.slice(w.length), attempt };
  }
  return { stem: s, attempt };
}

function classifyStem(stem: string): { role: SketchRole; poolScope?: 'grade' | 'class'; confidence: number } {
  const t = stem.trim();
  if (!t) return { role: 'unknown', confidence: 0.1 };
  if (t.includes('姓名') || t.includes('名字')) return { role: 'student.name', confidence: 0.98 };
  // 班名一族要先于「名次/排名」判断，否则「班级排名」会落进年级名次
  if (t === '班名' || t.endsWith('班名') || t.includes('班排名') || t.includes('班级排名') || t.includes('班名次'))
    return { role: 'exam.rank', poolScope: 'class', confidence: 0.8 };
  if (t === '班级' || t === '班别') return { role: 'student.class', confidence: 0.95 };
  if (t.includes('导师') || t === '负责教师' || t === '负责人') return { role: 'advisor', confidence: 0.95 };
  if (t.includes('分层') || t === '层') return { role: 'tier', confidence: 0.95 };
  if (t.endsWith('总分')) return { role: 'exam.total', confidence: 0.9 };
  if (t.endsWith('级名') || t.endsWith('名次') || t.endsWith('排名'))
    return { role: 'exam.rank', poolScope: 'grade', confidence: 0.9 };
  if (t.endsWith('分数') || t.endsWith('成绩') || t.endsWith('得分'))
    return { role: 'subject.score', confidence: 0.95 };
  if (t === '浮动' || t === '进退步' || t === '升降' || t === '变化')
    return { role: 'derived', confidence: 0.9 };
  return { role: 'unknown', confidence: 0.1 };
}

export function detect(table: Cell[][]): StructureSketch {
  const warnings: string[] = [];
  const rows = table.length;
  const colCount = Math.max(0, ...table.map((r) => r.length));
  if (rows === 0 || colCount === 0) {
    return {
      headerRows: 0, titleText: null, columns: [], subjectGroups: [], derivedColumns: [],
      warnings: ['空表格，无内容可导入'], dataStartRow: 1, dataEndRow: 0,
    };
  }

  const at = (r: number, c: number): Cell => norm(table[r]?.[c] ?? null);

  // ---- 1. 表头行数：从顶部往下，第一个含数字/缺考标记/人名的行是数据首行 ----
  // （「张三｜缺考」这种全文本数据行会被误认成表头——2026-11 修）
  let headerRowCount = 0;
  let titleText: string | null = null;
  const titleRowIdx: number[] = [];
  for (let r = 0; r < Math.min(rows, 6); r++) {
    const numeric = table[r].filter((c) => isNum(norm(c))).length;
    if (numeric >= 1) break;
    const strVals = table[r].map((c) => norm(c)).filter((c): c is string => typeof c === 'string');
    // 缺考标记只会出现在数据行
    if (strVals.some((v) => ABSENT_MARK_RE.test(halfWidth(v)))) break;
    // 标题行：所有非空格都是同一句长文本（合并单元格会被 exceljs 复制到每个格子）
    const vals = [...new Set(strVals)];
    if (headerRowCount === 0 && vals.length === 1 && vals[0].length >= 6) {
      titleText = vals[0];
      titleRowIdx.push(r);
      headerRowCount++;
      continue;
    }
    // 人名伪装表头：首个非空格是短文本且不含任何表头词 → 数据区开始
    const firstNonEmpty = table[r].map((c) => norm(c)).find((c) => c != null);
    if (typeof firstNonEmpty === 'string' && !HEADER_VOCAB.some((w) => firstNonEmpty.includes(w))) {
      break;
    }
    headerRowCount++;
  }
  if (headerRowCount === 0) {
    warnings.push('未识别出表头，前几行都不是纯文本');
  }
  const dataStartIdx = headerRowCount; // 0 起的行下标
  const dataStartRow = headerRowCount + 1; // 1 起对外

  // ---- 2. 数据末行：剔除末尾的合计/平均行与空行 ----
  let endIdx = -1;
  let droppedSummary: string | null = null;
  for (let r = rows - 1; r >= dataStartIdx; r--) {
    const name = at(r, 0);
    const anyContent = nonEmptyCount(table[r]) > 0;
    if (!anyContent) continue;
    if (endIdx === -1) {
      if (typeof name === 'string' && SUMMARY_NAME_RE.test(name)) {
        droppedSummary = name;
        continue; // 末尾合计/平均行
      }
      endIdx = r;
    } else {
      break;
    }
  }
  if (endIdx === -1) endIdx = dataStartIdx - 1;
  if (droppedSummary) warnings.push(`末行「${droppedSummary}」疑似合计/平均行，已排除出数据区`);
  const dataEndRow = endIdx + 1; // 1 起含

  // ---- 3. 每列表头文本：自底向上合并去重（多级表头：底行是量词，上行是科目）----
  // 标题行不参与列头合并
  const colTexts: string[][] = [];
  for (let c = 0; c < colCount; c++) {
    const texts: string[] = [];
    for (let r = headerRowCount - 1; r >= 0; r--) {
      if (titleRowIdx.includes(r)) continue;
      const v = at(r, c);
      if (typeof v === 'string' && !texts.includes(v)) texts.push(v);
    }
    colTexts.push(texts);
  }

  // ---- 4. 逐列分类 ----
  const cols: ColumnSketch[] = [];
  for (let c = 0; c < colCount; c++) {
    const texts = colTexts[c];
    const metric = texts[0] ?? '';
    const upper = texts.slice(1).join('');
    const parts = splitHeader(metric);
    let subject = parts.subject;
    if (!subject) {
      for (const w of SUBJECT_WORDS) {
        if (upper.includes(w)) { subject = w; break; }
      }
    }
    const stem = parts.stem || (subject ? '' : metric);
    const cls = classifyStem(stem);
    let role = cls.role;
    // 只有科目词、没有量词的表头（如「语文」）→ 该科的分数列
    if (role === 'unknown' && subject && !parts.stem) {
      role = 'subject.score';
      cls.role = role;
      cls.confidence = 0.95;
    }
    // rank + attempt 1 + 有科目 → 上次名次
    if (role === 'exam.rank' && parts.attempt === 1 && subject) role = 'subject.rankPrev';
    // 带科目的名次列归 subject.rank
    if (role === 'exam.rank' && subject) role = 'subject.rank';
    const header = [...texts].reverse().join(' ');
    const examish =
      role === 'exam.total' || role === 'exam.rank' || role === 'subject.score' ||
      role === 'subject.rank' || role === 'subject.rankPrev' || role === 'tier';
    cols.push({
      index: c + 1,
      header,
      role,
      subject,
      attempt: parts.attempt ?? (examish ? 2 : undefined),
      poolScope: cls.poolScope,
      confidence: cls.confidence,
    });
  }

  // ---- 5. 无科目的裸列（级名2/班名等）按位置归左：仅当与某科目组之间隔着全是科目列 ----
  const groups: SubjectGroup[] = [];
  const groupOfCol = new Map<number, SubjectGroup>();
  for (const col of cols) {
    if (!col.subject) continue;
    let g = groups.find((x) => x.subject === col.subject);
    if (!g) {
      g = { subject: col.subject, columns: {} };
      groups.push(g);
    }
    groupOfCol.set(col.index, g);
  }
  const isGroupCol = (idx: number) => groupOfCol.has(idx);
  const bareAttached: ColumnSketch[] = [];
  for (const col of cols) {
    if (col.subject) continue;
    if (col.role !== 'exam.rank' && col.role !== 'tier' && col.role !== 'subject.score') continue;
    // 只归并「纯量词表头」（级名2/名次/分数…）；长表头留给确认页人工指定
    if (!BARE_HEADER_RE.test(col.header.replace(/\s+/g, ''))) continue;
    // 向左找最近的科目列
    let anchor: number | null = null;
    for (let i = col.index - 1; i >= 1; i--) {
      if (isGroupCol(i)) { anchor = i; break; }
    }
    if (anchor == null) continue;
    const g = groupOfCol.get(anchor)!;
    // 锚点列与本列之间必须全是科目列（否则像 flat 的「总分 班名」结构，不归组）
    let separated = false;
    for (let i = anchor + 1; i < col.index; i++) {
      if (!isGroupCol(i)) { separated = true; break; }
    }
    if (separated) continue;
    const key = col.role === 'tier' ? 'tier' : col.role === 'subject.score' ? 'score' : 'rank';
    if (g.columns[key]) continue; // 该科目组已有此量，不再抢
    g.columns[key] = col.index;
    col.subject = g.subject;
    if (col.role === 'exam.rank') col.role = 'subject.rank';
    if (col.role === 'subject.score') col.role = 'subject.score';
    col.confidence = Math.min(col.confidence, 0.75); // 位置归并，置信度降档
    bareAttached.push(col);
  }
  if (bareAttached.length >= 2) {
    const sameHeader = bareAttached[0].header;
    const allSame = bareAttached.every((c) => c.header === sameHeader);
    const idxs = bareAttached.map((c) => c.index).join('/');
    if (allSame) {
      warnings.push(`列 ${idxs} 表头同为「${sameHeader}」，按位置归到最近的科目前缀`);
    } else {
      warnings.push(`列 ${idxs} 无科目表头，按位置归到最近的科目前缀`);
    }
  }

  // ---- 6. 补齐科目组的各量（有科目前缀的列） ----
  for (const col of cols) {
    if (!col.subject) continue;
    const g = groups.find((x) => x.subject === col.subject)!;
    if (col.role === 'tier') g.columns.tier = col.index;
    else if (col.role === 'subject.rankPrev') g.columns.rankPrev = col.index;
    else if (col.role === 'subject.rank' && col.attempt === 1) g.columns.rankPrev = col.index;
    else if (col.role === 'subject.rank') g.columns.rank = col.index;
    else if (col.role === 'subject.score' && col.attempt !== 1) g.columns.score = col.index;
  }

  // ---- 6.5 无科目且未归并的分数/分层列：留给确认页，并给 warning ----
  for (const col of cols) {
    if (col.subject) continue;
    // exam.rank 不需要科目（那是总分名次列），其余量词列没有科目就导不进去
    if (col.role !== 'subject.score' && col.role !== 'tier') continue;
    warnings.push(
      `列 ${col.index}「${col.header}」没认出科目词，默认不导入；如需导入请在确认页为它填科目名`,
    );
  }

  // ---- 6.6 次别超出常规范围（1~3）的列：给 warning，请老师在确认页核对 ----
  for (const col of cols) {
    if (col.attempt == null || col.attempt <= 3) continue;
    if (!['exam.rank', 'exam.total', 'subject.score', 'subject.rank', 'subject.rankPrev', 'tier'].includes(col.role)) continue;
    warnings.push(`列 ${col.index}「${col.header}」的次别是第${col.attempt}次，超出支持范围（当前支持第1~3次），请在确认页核对该列`);
  }

  // ---- 7. 派生列 ----
  const derivedColumns: DerivedColumn[] = [];
  for (const col of cols) {
    if (col.role !== 'derived') continue;
    const hasBothRank = cols.some((c) => c.role === 'exam.rank' && c.attempt === 2)
      && cols.some((c) => c.role === 'exam.rank' && c.attempt === 1);
    derivedColumns.push({
      index: col.index,
      header: col.header,
      reason: hasBothRank ? '疑似 = 级名1 − 级名' : '疑似由其他列计算得出',
    });
  }
  if (derivedColumns.length) {
    warnings.push(`检测到派生列 ${derivedColumns.map((d) => `「${d.header}」`).join('、')}，导入时不落库`);
  }

  // ---- 8. 数据区坏数据扫描（不崩，给 warning） ----
  let nameCol = cols.find((c) => c.role === 'student.name');
  if (!nameCol) {
    warnings.push('缺少「姓名」列（表头为空或无法识别），无法确定学生身份，需要人工指定');
  }
  let emptyRows = 0;
  const rowSig = new Map<string, number>();
  const absentMarkCols: Map<number, { n: number; sample: string }> = new Map();
  const textScoreCols: Map<number, { n: number; sample: string }> = new Map();
  for (let r = dataStartIdx; r <= endIdx; r++) {
    if (nonEmptyCount(table[r]) === 0) { emptyRows++; continue; }
    const sig = table[r].map((c) => String(norm(c) ?? '')).join('\x1f');
    if (rowSig.has(sig)) {
      warnings.push(`疑似重复行：第 ${rowSig.get(sig)! + 1} 行与第 ${r + 1} 行内容一致，导入时将去重`);
    } else {
      rowSig.set(sig, r);
    }
    // 分数/名次列里的文本值：缺考标记 / 全角数字（可正常导入）/ 其他文本，分开提示
    for (const col of cols) {
      if (col.role !== 'subject.score' && col.role !== 'subject.rank' && col.role !== 'exam.total') continue;
      const v = at(r, col.index - 1);
      if (typeof v !== 'string') continue;
      if (isNum(v)) continue; // 全角/文本数字能正常导入，不算坏数据
      const target = ABSENT_MARK_RE.test(halfWidth(v)) ? absentMarkCols : textScoreCols;
      const rec = target.get(col.index) ?? { n: 0, sample: v };
      rec.n++;
      target.set(col.index, rec);
    }
  }
  if (emptyRows > 0) warnings.push(`数据区含 ${emptyRows} 个空行，导入时将跳过`);
  for (const [idx, rec] of absentMarkCols) {
    warnings.push(`列 ${idx} 有 ${rec.n} 处「${rec.sample}」这类缺考标记，将按缺考（空）处理`);
  }
  for (const [idx, rec] of textScoreCols) {
    warnings.push(`列 ${idx} 有 ${rec.n} 处文本值（如「${rec.sample}」），将按缺考（空）处理`);
  }

  return {
    headerRows: headerRowCount,
    titleText,
    columns: cols,
    subjectGroups: groups,
    derivedColumns,
    warnings,
    dataStartRow,
    dataEndRow,
  };
}
