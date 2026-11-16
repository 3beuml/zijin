/**
 * 周汇总：本周覆盖（每个学生本周有没有被记录过）+ 未覆盖名单 + 周登记表。
 * 周一为一周之始。
 */
import type { Attendance, Exam, Homework, RankPool, RecordItem, Score, Student } from './types.ts';
import { totalFor } from './score.ts';
import { attendanceWeekLabel } from './attendance.ts';

/** 'YYYY-MM-DD' → 当日所在周的 [周一, 周日]，均 'YYYY-MM-DD' */
export function weekOf(date: string): { start: string; end: string } {
  const [y, m, d] = date.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const day = new Date(utc).getUTCDay(); // 0=周日 … 6=周六
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(utc + offsetToMonday * 86400000);
  const end = new Date(utc + (offsetToMonday + 6) * 86400000);
  return { start: iso(start), end: iso(end) };
}

function iso(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface WeeklySummary {
  start: string;
  end: string;
  total: number; // 学生总数
  covered: number; // 本周有记录的学生数
  uncovered: Student[]; // 本周还没有记录的学生
  countByStudent: Map<string, number>; // studentId → 本周记录条数
}

/** 汇总 [start, end] 一周内的记录覆盖情况 */
export function weeklySummary(students: Student[], records: RecordItem[], refDate: string): WeeklySummary {
  const { start, end } = weekOf(refDate);
  const countByStudent = new Map<string, number>();
  for (const r of records) {
    if (r.date < start || r.date > end) continue; // 'YYYY-MM-DD' 字典序 = 时间序
    countByStudent.set(r.studentId, (countByStudent.get(r.studentId) ?? 0) + 1);
  }
  const uncovered: Student[] = [];
  for (const s of students) {
    if (!countByStudent.has(s.id)) uncovered.push(s);
  }
  return {
    start,
    end,
    total: students.length,
    covered: students.length - uncovered.length,
    uncovered,
    countByStudent,
  };
}

/** 某学生按时间倒序的记录（新在前） */
export function recordsOf(records: RecordItem[], studentId: string): RecordItem[] {
  return records
    .filter((r) => r.studentId === studentId)
    .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
}

/** 登记表一行：一个学生本周的次数 + 最近成绩 + 摘要 + 考勤/作业（v0.6，周手册 16 人表用） */
export interface WeekRow {
  student: Student;
  countByType: Map<string, number>; // 记录类型 → 本周次数
  count: number; // 本周总条数
  summary: string; // 最近一条记录的内容（本周无记录 → ''）
  total: number | null; // 最近一次考试的总分（现算）
  rank: number | null; // 最近一次考试的总分名次
  poolLabel: string; // 名次池标签（没有池则 ''）
  attendanceLabel: string; // 本周考勤短标签（'迟到2 病假1'，无 → ''）
  homeworkMissed: number | null; // 本周作业未交次数（周内无作业 → null）
}

/**
 * 周登记表（参考 teacher 的周工作手册：每人一行）。
 * 最近成绩取 order 最大的考试；名次带池标签。
 * v0.6 加考勤/作业两列（teacher §5.7 的登记表字段）；extras 不传则两列为空（旧调用兼容）。
 */
export function weeklyRegister(
  students: Student[],
  records: RecordItem[],
  scores: Score[],
  exams: Exam[],
  refDate: string,
  extras?: { attendance?: Attendance[]; homework?: Homework[] },
): { start: string; end: string; rows: WeekRow[] } {
  const { start, end } = weekOf(refDate);
  const latestExam = [...exams].sort((a, b) => b.order - a.order)[0];

  const rows = students.map((student) => {
    const countByType = new Map<string, number>();
    let summary = '';
    let latest: RecordItem | null = null;
    for (const r of records) {
      if (r.studentId !== student.id || r.date < start || r.date > end) continue;
      countByType.set(r.type, (countByType.get(r.type) ?? 0) + 1);
      if (!latest || (r.createdAt || r.date) > (latest.createdAt || latest.date)) latest = r;
    }
    if (latest) summary = latest.content;

    let total: number | null = null;
    let rank: number | null = null;
    let poolLabel = '';
    if (latestExam) {
      total = totalFor(scores, student.id, latestExam.id);
      const totalScore = scores.find(
        (s) => s.studentId === student.id && s.examId === latestExam.id && s.subject === '总分',
      );
      if (totalScore) {
        rank = totalScore.rank;
        const pool: RankPool = totalScore.pool;
        poolLabel =
          pool.scope === 'tier' ? `${pool.tier ?? ''}层内` : pool.scope === 'class' ? '班内' : '全年级';
      }
    }

    // 本周考勤短标签（'迟到2 病假1'）
    const attendanceLabel = extras?.attendance
      ? attendanceWeekLabel(extras.attendance, student.id, start, end)
      : '';
    // 本周作业未交次数（迟交也算没交口径之外的独立项，这里只数「未交」）；周内没有作业 → null
    let homeworkMissed: number | null = null;
    if (extras?.homework) {
      const inWeek = extras.homework.filter((h) => h.date >= start && h.date <= end);
      homeworkMissed = inWeek.reduce(
        (n, h) => n + (h.records.find((r) => r.studentId === student.id)?.status === '未交' ? 1 : 0),
        0,
      );
    }

    return {
      student,
      countByType,
      count: [...countByType.values()].reduce((a, b) => a + b, 0),
      summary,
      total,
      rank,
      poolLabel,
      attendanceLabel,
      homeworkMissed,
    };
  });

  return { start, end, rows };
}
