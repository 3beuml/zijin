/**
 * 作业登记统计（v0.6，teacher §5.3.3）。
 * 核心是「这个学生这周第 3 次没交」：未交次数 + 连续未交的次数（按日期倒序数）。
 * 口径：免交不算未交；某次作业里没有该生的记录（漏登记）不当作未交。
 */
import type { Homework, HomeworkRecord, HomeworkStatus } from './types.ts';

export const HOMEWORK_STATUSES: HomeworkStatus[] = ['交', '迟交', '未交', '补交', '免交'];

/** 没交 = 未交或迟交（补交后不算没交，免交不算没交） */
export function isUnsubmitted(r: HomeworkRecord | undefined): boolean {
  return r != null && (r.status === '未交' || r.status === '迟交');
}

/** 作业按日期倒序（同日按创建时间倒序） */
function byDateDesc(homeworks: Homework[]): Homework[] {
  return [...homeworks].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

export interface HomeworkStats {
  missed: number; // 未交次数
  late: number; // 迟交次数
  streak: number; // 连续未交（按日期倒序，从最近一次登记算起）
  latestMissed: { date: string; subject?: string; status: HomeworkStatus }[]; // 最近 3 次没交的明细
}

export function homeworkStats(homeworks: Homework[], studentId: string): HomeworkStats {
  let missed = 0;
  let late = 0;
  let streak = 0;
  let streakBroken = false;
  const latestMissed: HomeworkStats['latestMissed'] = [];
  for (const hw of byDateDesc(homeworks)) {
    const rec = hw.records.find((r) => r.studentId === studentId);
    if (rec == null) continue; // 漏登记不当作未交
    if (rec.status === '未交') {
      missed++;
      if (latestMissed.length < 3) latestMissed.push({ date: hw.date, subject: hw.subject, status: rec.status });
    } else if (rec.status === '迟交') {
      late++;
      if (latestMissed.length < 3) latestMissed.push({ date: hw.date, subject: hw.subject, status: rec.status });
    }
    // 连续未交：遇到第一个非未交就断（迟交也算没交，延续 streak）
    if (!streakBroken) {
      if (isUnsubmitted(rec)) streak++;
      else streakBroken = true;
    }
  }
  return { missed, late, streak, latestMissed };
}

/** 一次作业里没交的学生名单（登记页顶部汇总用） */
export function missingStudentsOf(hw: Homework): string[] {
  return hw.records.filter((r) => r.status === '未交').map((r) => r.studentId);
}
