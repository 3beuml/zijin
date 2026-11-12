/**
 * 考试统计（teacher 的成绩分析子集：班均 / 前三名 / 分包对比）。
 * 口径：用库里现算的总分行（subject='总分'）与各科 raw；不含缺考（raw null）。
 * 得分率不做——库里没有满分字段，宁缺毋滥（teacher 教训：口径不统一比没有更糟）。
 */
import type { Exam, Score, Student } from './types.ts';
import { TOTAL_SUBJECT } from './types.ts';
import { round1 } from './score.ts';

export interface SubjectStat {
  subject: string;
  count: number; // 有分数的人数
  avg: number;
  max: number;
  min: number;
}

export interface TopStudent {
  studentId: string;
  name: string;
  total: number;
  rank: number | null;
  poolLabel: string; // 池标签（「全年级」等）
}

export interface ExamStats {
  examId: string;
  label: string;
  subjects: SubjectStat[];
  totalAvg: number | null;
  totalMax: number | null;
  top3: TopStudent[];
}

export function examStats(
  scores: Score[],
  exams: Exam[],
  students: Student[],
  examId: string,
): ExamStats | null {
  const exam = exams.find((e) => e.id === examId);
  if (!exam) return null;
  const rows = scores.filter((s) => s.examId === examId);

  const bySubject = new Map<string, number[]>();
  for (const s of rows) {
    if (s.raw == null || s.subject === TOTAL_SUBJECT) continue;
    if (!bySubject.has(s.subject)) bySubject.set(s.subject, []);
    bySubject.get(s.subject)!.push(s.raw);
  }
  const subjects: SubjectStat[] = [...bySubject.entries()]
    .map(([subject, arr]) => ({
      subject,
      count: arr.length,
      avg: round1(arr.reduce((a, b) => a + b, 0) / arr.length),
      max: Math.max(...arr),
      min: Math.min(...arr),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject, 'zh'));

  const totals = rows.filter((s) => s.subject === TOTAL_SUBJECT && s.raw != null);
  const totalAvg = totals.length ? round1(totals.reduce((a, b) => a + (b.raw ?? 0), 0) / totals.length) : null;
  const totalMax = totals.length ? Math.max(...totals.map((t) => t.raw ?? 0)) : null;

  const top3: TopStudent[] = [...totals]
    .sort((a, b) => (b.raw ?? 0) - (a.raw ?? 0))
    .slice(0, 3)
    .map((t) => {
      const stu = students.find((s) => s.id === t.studentId);
      return {
        studentId: t.studentId,
        name: stu?.name ?? '?',
        total: t.raw ?? 0,
        rank: t.rank,
        poolLabel:
          t.pool.scope === 'tier'
            ? `${t.pool.tier ?? ''}层内`
            : t.pool.scope === 'class'
              ? '班内'
              : '全年级',
      };
    });

  return { examId, label: exam.label, subjects, totalAvg, totalMax, top3 };
}

/** 每个学生的总分与班均差（分包对比表用；缺考 → null） */
export interface StudentTotalRow {
  studentId: string;
  name: string;
  total: number | null;
  rank: number | null;
  poolLabel: string;
  vsAvg: number | null; // 总分 − 班均
}

export function studentTotals(
  scores: Score[],
  exams: Exam[],
  students: Student[],
  examId: string,
): { rows: StudentTotalRow[]; totalAvg: number | null } {
  const stats = examStats(scores, exams, students, examId);
  const totalAvg = stats?.totalAvg ?? null;
  const rows = students.map((stu) => {
    const t = scores.find(
      (s) => s.examId === examId && s.studentId === stu.id && s.subject === TOTAL_SUBJECT,
    );
    const total = t?.raw ?? null;
    return {
      studentId: stu.id,
      name: stu.name,
      total,
      rank: t?.rank ?? null,
      poolLabel: t
        ? t.pool.scope === 'tier'
          ? `${t.pool.tier ?? ''}层内`
          : t.pool.scope === 'class'
            ? '班内'
            : '全年级'
        : '',
      vsAvg: total != null && totalAvg != null ? round1(total - totalAvg) : null,
    };
  });
  return { rows, totalAvg };
}
