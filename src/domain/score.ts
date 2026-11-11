/**
 * 成绩计算：总分现算（派生值不落库源数据）、跨考试名次浮动（同池才可比）。
 */
import { CORE_SUBJECTS, TOTAL_SUBJECT } from './types';
import type { Score } from './types';
import { samePool } from './pool';

/** 一个学生在某次考试的总分 = 其已有科目分数之和；一科都没有 → null */
export function totalFor(scores: Score[], studentId: string, examId: string): number | null {
  let sum = 0;
  let any = false;
  for (const s of scores) {
    if (s.studentId !== studentId || s.examId !== examId) continue;
    if (s.subject === TOTAL_SUBJECT) continue;
    if (s.raw == null) continue;
    sum += s.raw;
    any = true;
  }
  return any ? round1(sum) : null;
}

/** 保留一位小数，避免浮点误差（0.1+0.2 问题） */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface RankDelta {
  comparable: boolean;
  delta: number | null; // 正 = 名次进步（上次名次 − 本次名次）
  reason?: string;
}

/**
 * 两次考试同科目的名次浮动。可比的前提：两次的池一致（subject/tier/scope 全同）。
 * 池变了 → 标记不可比，绝不给差值。
 */
export function rankDelta(prev: Score | undefined, curr: Score | undefined): RankDelta {
  if (!prev || !curr) return { comparable: false, delta: null, reason: '缺一次考试的数据' };
  if (prev.rank == null || curr.rank == null)
    return { comparable: false, delta: null, reason: '有名次缺失' };
  if (!samePool(prev.pool, curr.pool))
    return { comparable: false, delta: null, reason: '两次考试排名池不同（如分层变了）' };
  return { comparable: true, delta: prev.rank - curr.rank };
}

/** 找某学生在某次考试某科目的分数行 */
export function findScore(
  scores: Score[],
  studentId: string,
  examId: string,
  subject: string,
): Score | undefined {
  return scores.find(
    (s) => s.studentId === studentId && s.examId === examId && s.subject === subject,
  );
}

/** 一个学生在某次考试的全部科目行（不含总分） */
export function subjectScores(scores: Score[], studentId: string, examId: string): Score[] {
  return scores.filter(
    (s) =>
      s.studentId === studentId &&
      s.examId === examId &&
      s.subject !== TOTAL_SUBJECT &&
      CORE_SUBJECTS.includes(s.subject as (typeof CORE_SUBJECTS)[number]),
  );
}
