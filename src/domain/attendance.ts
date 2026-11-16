/**
 * 考勤统计（v0.6，teacher §5.3.6 的班主任刚需子集）。
 * 口径：迟到/早退/病假/事假/旷课/离校按类型计数；
 * 周手册只给「本周有几次、是什么类型」的短标签，不做图形。
 */
import type { Attendance } from './types.ts';

/** 某学生的考勤时间线（新在前） */
export function attendanceOf(items: Attendance[], studentId: string): Attendance[] {
  return items
    .filter((a) => a.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** 按类型计数（可选限定学生）；类型按出现顺序排列 */
export function countByType(items: Attendance[], studentId?: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of items) {
    if (studentId && a.studentId !== studentId) continue;
    out.set(a.type, (out.get(a.type) ?? 0) + 1);
  }
  return out;
}

/** 某学生在 [start, end] 的考勤短标签（周手册用）：'迟到2 病假1'；无考勤 → '' */
export function attendanceWeekLabel(
  items: Attendance[],
  studentId: string,
  start: string,
  end: string,
): string {
  const inWeek = items.filter(
    (a) => a.studentId === studentId && a.date >= start && a.date <= end,
  );
  if (inWeek.length === 0) return '';
  return [...countByType(inWeek)]
    .map(([type, n]) => (n > 1 ? `${type}${n}` : type))
    .join(' ');
}
