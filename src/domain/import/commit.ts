/**
 * commit：映射 + 数据 → 落库（合并进现有 AppData）+ 校验报告。纯函数。
 *
 * 铁律落地点：
 * - 总分永远现算，不读表内总分数值（表内值只用来对照报警）
 * - 名次必须带池：分层科目 → tier 池；不分层 → 年级池；表里没有名次 → 按导入范围现算（班内池）
 * - 上次考试的分数列不导入（模型只留上次的名次做浮动），总分1 的数值丢弃
 */
import {
  TOTAL_SUBJECT,
  type AppData,
  type Exam,
  type Score,
  type Student,
  type Tier,
} from '../types.ts';
import { parseTierLabel } from '../pool.ts';
import { computeRanks } from '../rank.ts';
import { totalFor } from '../score.ts';
import type { Cell, CommitOptions, ImportMapping, MappingColumn } from './types.ts';

function cellAt(table: Cell[][], row1: number, col1: number): Cell {
  const v = table[row1 - 1]?.[col1 - 1];
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return v;
}

/** 数值解析：数字照收；文本数字照收（计数）；其他文本 → null（缺考） */
function toNumber(v: Cell): { raw: number | null; textNumeric: boolean; absent: boolean } {
  if (v == null) return { raw: null, textNumeric: false, absent: false };
  if (typeof v === 'number') return { raw: Number.isFinite(v) ? v : null, textNumeric: false, absent: false };
  if (/^-?\d+(\.\d+)?$/.test(v)) return { raw: Number(v), textNumeric: true, absent: false };
  return { raw: null, textNumeric: false, absent: true };
}

function nextId(prefix: string, existing: string[]): string {
  let max = 0;
  for (const id of existing) {
    const m = id.match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}

export interface CommitResult {
  data: AppData;
  report: {
    warnings: string[];
    studentsCreated: number;
    studentsMatched: number;
    examsCreated: number;
    scoresWritten: number;
    droppedRows: { row: number; reason: string }[];
  };
}

const SUMMARY_NAME_RE = /^(班级|全班)?\s*(平均|合计|均分|总分|总计|小计)/;

export function commit(
  existing: AppData,
  table: Cell[][],
  mapping: ImportMapping,
  options: CommitOptions = {},
): CommitResult {
  const warnings: string[] = [...mapping.warnings];
  const droppedRows: { row: number; reason: string }[] = [];

  // ---- 结构克隆现有数据（只增不改，除非明确要补） ----
  const students: Student[] = existing.students.map((s) => ({ ...s }));
  const exams: Exam[] = existing.exams.map((e) => ({ ...e }));
  const scores: Score[] = existing.scores.map((s) => ({ ...s }));

  const col = (role: string, pred?: (c: MappingColumn) => boolean): MappingColumn | undefined =>
    mapping.columns.find((c) => c.role === role && (!pred || pred(c)));

  const nameCol = col('student.name');
  const classCol = col('student.class');
  const advisorCol = col('advisor');

  if (!nameCol) {
    // 没有姓名列无法安全落库：宁可停也不写脏数据
    return {
      data: existing,
      report: {
        warnings: [...warnings, '没有可用的姓名列，已拒绝落库（数据一个都没写）'],
        studentsCreated: 0, studentsMatched: 0, examsCreated: 0, scoresWritten: 0, droppedRows,
      },
    };
  }

  // ---- 班级 ----
  let classId = options.classId;
  if (!classId && classCol) {
    for (let r = mapping.dataStartRow; r <= mapping.dataEndRow; r++) {
      const v = cellAt(table, r, classCol.index);
      if (v != null) { classId = String(v); break; }
    }
  }
  classId = classId ?? 'c1';

  // ---- 考试：attempt → Exam（按 label 复用既有考试） ----
  const attempts = new Set<number>();
  for (const c of mapping.columns) {
    if (c.role === 'subject.score' || c.role === 'subject.rank' || c.role === 'exam.total' || c.role === 'exam.rank') {
      if (c.attempt) attempts.add(c.attempt);
    }
  }
  if (attempts.size === 0) attempts.add(2);
  const attemptList = [...attempts].sort((a, b) => a - b);
  const examByAttempt = new Map<number, Exam>();
  let examsCreated = 0;
  for (const attempt of attemptList) {
    const label = options.examLabels?.[attempt] ?? mapping.examLabels[attempt] ?? `第${attempt}次`;
    const date = options.examDates?.[attempt] ?? '';
    const found = exams.find((e) => e.label === label);
    if (found) {
      examByAttempt.set(attempt, found);
      continue;
    }
    const exam: Exam = {
      id: nextId('e', exams.map((e) => e.id)),
      label,
      date,
      order: attempt,
    };
    exams.push(exam);
    examByAttempt.set(attempt, exam);
    examsCreated++;
  }
  const currExam = examByAttempt.get(Math.max(...attemptList))!;
  const prevExam = attemptList.length > 1 ? examByAttempt.get(Math.min(...attemptList)) : undefined;

  // ---- 科目组：来自映射列 ----
  interface Group {
    subject: string;
    scoreCol?: MappingColumn;
    rankCol?: MappingColumn;
    rankPrevCol?: MappingColumn;
    tierCol?: MappingColumn;
  }
  const groups = new Map<string, Group>();
  for (const c of mapping.columns) {
    if (!c.subject) continue;
    let g = groups.get(c.subject);
    if (!g) { g = { subject: c.subject }; groups.set(c.subject, g); }
    if (c.role === 'subject.score' && c.attempt !== 1) g.scoreCol = c;
    else if (c.role === 'subject.rank' && c.attempt !== 1) g.rankCol = c;
    else if (c.role === 'subject.rankPrev' || (c.role === 'subject.rank' && c.attempt === 1)) g.rankPrevCol = c;
    else if (c.role === 'tier') g.tierCol = c;
  }

  // ---- 学生行 ----
  const nameToStudent = new Map<string, Student>();
  const rowOfStudent = new Map<string, number>(); // name → 首次出现的行（后续同名行一律视为重复丢弃）
  let studentsCreated = 0;
  let studentsMatched = 0;
  const tierMissingBySubject = new Map<string, number>();

  for (let r = mapping.dataStartRow; r <= mapping.dataEndRow; r++) {
    const nameV = cellAt(table, r, nameCol.index);
    if (nameV == null) {
      const rowHasAnyCell = mapping.columns.some((c) => cellAt(table, r, c.index) != null);
      if (rowHasAnyCell) droppedRows.push({ row: r, reason: '姓名为空' });
      continue; // 空行静默跳过
    }
    const name = String(nameV);
    if (SUMMARY_NAME_RE.test(name)) {
      droppedRows.push({ row: r, reason: '合计/平均行' });
      continue;
    }
    if (nameToStudent.has(name)) {
      droppedRows.push({ row: r, reason: `与前方行同名（${name}），按重复行去重` });
      continue;
    }

    const advisorV = advisorCol ? cellAt(table, r, advisorCol.index) : null;
    const advisor = advisorV != null ? String(advisorV) : '';
    if (!advisor) warnings.push(`学生「${name}」没有导师信息`);

    let stu = students.find((s) => s.name === name && s.classId === classId);
    if (stu) {
      studentsMatched++;
      if (!stu.advisor && advisor) stu.advisor = advisor;
    } else {
      stu = { id: nextId('s', students.map((s) => s.id)), name, classId, advisor };
      students.push(stu);
      studentsCreated++;
    }
    nameToStudent.set(name, stu);
    rowOfStudent.set(name, r);
  }
  if (studentsCreated + studentsMatched === 0) {
    warnings.push('数据区没有解析出任何学生');
  }

  // ---- 分层解析（每生每科） ----
  const tierOf = new Map<string, Tier | null>(); // `${studentId}|${subject}` → tier
  for (const [name, r] of rowOfStudent) {
    const stu = nameToStudent.get(name)!;
    for (const g of groups.values()) {
      if (!g.tierCol) continue;
      const v = cellAt(table, r, g.tierCol.index);
      const tier = typeof v === 'string' ? parseTierLabel(v) : null;
      if (tier == null && v != null) {
        tierMissingBySubject.set(g.subject, (tierMissingBySubject.get(g.subject) ?? 0) + 1);
      }
      tierOf.set(`${stu.id}|${g.subject}`, tier);
    }
  }
  for (const [subject, n] of tierMissingBySubject) {
    warnings.push(`科目「${subject}」有 ${n} 个学生的分层无法解析，这些学生按年级池处理`);
  }

  // ---- 分数 ----
  let scoresWritten = 0;
  const absentByCol = new Map<number, number>();
  const textNumericByCol = new Map<number, number>();
  const fileTotalCells = new Map<string, number | null>(); // `${examId}|${studentId}` → 表内总分

  for (const g of groups.values()) {
    // 本次考试：分数 + 名次
    if (g.scoreCol) {
      const needComputedRank = !g.rankCol;
      let computed: Map<string, number> | null = null;
      if (needComputedRank) {
        const entries: { studentId: string; raw: number }[] = [];
        for (const [name, r] of rowOfStudent) {
          const stu = nameToStudent.get(name)!;
          const { raw } = toNumber(cellAt(table, r, g.scoreCol.index));
          if (raw != null) entries.push({ studentId: stu.id, raw });
        }
        computed = computeRanks(entries);
        warnings.push(`科目「${g.subject}」表内没有名次列，已按导入范围现算名次（班内池）`);
      }
      for (const [name, r] of rowOfStudent) {
        const stu = nameToStudent.get(name)!;
        const parsed = toNumber(cellAt(table, r, g.scoreCol.index));
        if (parsed.textNumeric) textNumericByCol.set(g.scoreCol.index, (textNumericByCol.get(g.scoreCol.index) ?? 0) + 1);
        if (parsed.absent) absentByCol.set(g.scoreCol.index, (absentByCol.get(g.scoreCol.index) ?? 0) + 1);
        const tier = tierOf.get(`${stu.id}|${g.subject}`) ?? null;
        const pool = tier
          ? { subject: g.subject, tier, scope: 'tier' as const }
          : { subject: g.subject, tier: null, scope: needComputedRank ? ('class' as const) : ('grade' as const) };
        const rank = computed ? computed.get(stu.id) ?? null : g.rankCol ? toNumber(cellAt(table, r, g.rankCol.index)).raw : null;
        scores.push({ studentId: stu.id, examId: currExam.id, subject: g.subject, raw: parsed.raw, rank, pool });
        scoresWritten++;
      }
    }
    // 上次考试：只有名次（rankPrev），分数列不导入
    if (g.rankPrevCol && prevExam) {
      for (const [name, r] of rowOfStudent) {
        const stu = nameToStudent.get(name)!;
        const parsed = toNumber(cellAt(table, r, g.rankPrevCol.index));
        const tier = tierOf.get(`${stu.id}|${g.subject}`) ?? null;
        const pool = tier ? { subject: g.subject, tier, scope: 'tier' as const } : { subject: g.subject, tier: null, scope: 'grade' as const };
        scores.push({ studentId: stu.id, examId: prevExam.id, subject: g.subject, raw: null, rank: parsed.raw, pool });
        scoresWritten++;
      }
    }
  }

  // ---- 总分：现算 + 表内名次 ----
  const totalRankCol = mapping.columns.find((c) => c.role === 'exam.rank' && c.attempt === 2);
  const totalRankPrevCol = mapping.columns.find((c) => c.role === 'exam.rank' && c.attempt === 1);
  const totalCol = mapping.columns.find((c) => c.role === 'exam.total' && c.attempt !== 1);
  const totalPoolClass = totalRankCol?.poolScope === 'class';

  for (const [name, r] of rowOfStudent) {
    const stu = nameToStudent.get(name)!;
    const total = totalFor(scores, stu.id, currExam.id);
    if (total != null) {
      const pool = totalPoolClass
        ? { subject: TOTAL_SUBJECT, tier: null, scope: 'class' as const }
        : { subject: TOTAL_SUBJECT, tier: null, scope: 'grade' as const };
      const rank = totalRankCol ? toNumber(cellAt(table, r, totalRankCol.index)).raw : null;
      scores.push({ studentId: stu.id, examId: currExam.id, subject: TOTAL_SUBJECT, raw: total, rank, pool });
      scoresWritten++;
      if (totalCol) {
        const v = toNumber(cellAt(table, r, totalCol.index));
        if (v.raw != null && Math.abs(v.raw - total) > 1e-6) {
          fileTotalCells.set(`${currExam.id}|${stu.id}`, v.raw);
        }
      }
    }
    // 上次考试总分：只留名次，不留数值
    if (prevExam && totalRankPrevCol) {
      const rank = toNumber(cellAt(table, r, totalRankPrevCol.index)).raw;
      if (rank != null) {
        scores.push({
          studentId: stu.id, examId: prevExam.id, subject: TOTAL_SUBJECT, raw: null, rank,
          pool: { subject: TOTAL_SUBJECT, tier: null, scope: totalPoolClass ? 'class' : 'grade' },
        });
        scoresWritten++;
      }
    }
  }
  if (fileTotalCells.size > 0) {
    warnings.push(`${fileTotalCells.size} 个学生的表内总分与四科之和不一致，已采用现算值`);
  }

  // ---- 提示 ----
  for (const [c, n] of absentByCol) {
    warnings.push(`列 ${c} 有 ${n} 处非数值（如「缺考」），按缺考（空）处理`);
  }
  for (const [c, n] of textNumericByCol) {
    warnings.push(`列 ${c} 有 ${n} 处文本形式的数字，已按数字导入，建议检查单元格格式`);
  }

  // 名次带池的最终校验：池内单调性
  const poolCheck = ((): string | null => {
    const pools = new Map<string, Score[]>();
    for (const s of scores) {
      if (s.raw == null || s.rank == null) continue;
      const k = `${s.examId}|${s.pool.subject}|${s.pool.tier ?? 'all'}|${s.pool.scope}`;
      if (!pools.has(k)) pools.set(k, []);
      pools.get(k)!.push(s);
    }
    for (const [k, arr] of pools) {
      arr.sort((a, b) => b.raw! - a.raw!);
      for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i].raw! > arr[i + 1].raw! && arr[i].rank! > arr[i + 1].rank!) {
          return `池 ${k} 内名次与分数出现逆序（${arr[i].raw}/${arr[i].rank} → ${arr[i + 1].raw}/${arr[i + 1].rank}），请核对名次列`;
        }
      }
    }
    return null;
  })();
  if (poolCheck) warnings.push(poolCheck);

  // 分层与总分校验性提示（对照 design-data 待确认项）
  const tierSubjects = [...groups.values()].filter((g) => g.tierCol).map((g) => g.subject);
  const gradeSubjects = [...groups.values()].filter((g) => !g.tierCol).map((g) => g.subject);
  if (tierSubjects.length) {
    warnings.push(`分层科目：${tierSubjects.join('、')}（名次按层内池）；不分层科目：${gradeSubjects.join('、') || '无'}（名次按年级池）`);
  }

  const data: AppData = {
    version: 1,
    students,
    exams,
    scores,
    records: existing.records.map((r) => ({ ...r })),
  };

  return {
    data,
    report: {
      warnings,
      studentsCreated,
      studentsMatched,
      examsCreated,
      scoresWritten,
      droppedRows,
    },
  };
}
