/**
 * 周汇总：本周覆盖（每个学生本周有没有被记录过）+ 未覆盖名单。
 * 周一为一周之始。
 */
import type { RecordItem, Student } from './types.ts';

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
