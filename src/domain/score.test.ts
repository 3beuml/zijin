import { describe, expect, it } from 'vitest';
import { findScore, rankDelta, round1, subjectScores, totalFor } from './score';
import type { Score } from './types';

const pool2 = { subject: '数学', tier: '2', scope: 'tier' } as const;
const poolGrade = { subject: '语文', tier: null, scope: 'grade' } as const;

function sc(
  examId: string,
  subject: string,
  raw: number | null,
  rank: number | null,
  pool: import('./types').RankPool = poolGrade,
): Score {
  return { studentId: 's1', examId, subject, raw, rank, pool: { ...pool } };
}

describe('totalFor', () => {
  const scores: Score[] = [
    sc('e1', '语文', 77, 18),
    sc('e1', '数学', 98, 2, pool2),
    sc('e1', '英语', 63.5, 11),
    sc('e1', '物理', 74.5, 16),
  ];
  it('总分 = 四科之和（现算，不读库里可能存在的总分行）', () => {
    expect(totalFor(scores, 's1', 'e1')).toBe(round1(77 + 98 + 63.5 + 74.5));
  });
  it('缺考一科 → 按已有科目求和', () => {
    const s = scores.filter((x) => x.subject !== '物理');
    expect(totalFor(s, 's1', 'e1')).toBe(round1(77 + 98 + 63.5));
  });
  it('一科都没有 → null', () => {
    expect(totalFor(scores, 's2', 'e1')).toBeNull();
  });
  it('raw 为 null 的行不计入', () => {
    const s = scores.map((x) => (x.subject === '物理' ? { ...x, raw: null } : x));
    expect(totalFor(s, 's1', 'e1')).toBe(round1(77 + 98 + 63.5));
  });
  it('只统计指定考试', () => {
    expect(totalFor([...scores, sc('e2', '数学', 50, 9, pool2)], 's1', 'e2')).toBe(50);
  });
});

describe('rankDelta（浮动）', () => {
  it('同池 → 可比，delta = 上次名次 − 本次名次', () => {
    const prev = sc('e1', '数学', null, 5, pool2);
    const curr = sc('e2', '数学', null, 9, pool2);
    expect(rankDelta(prev, curr)).toEqual({ comparable: true, delta: -4 });
  });
  it('池不同（分层变了）→ 不可比', () => {
    const prev = sc('e1', '数学', null, 5, { subject: '数学', tier: '1', scope: 'tier' });
    const curr = sc('e2', '数学', null, 9, pool2);
    const d = rankDelta(prev, curr);
    expect(d.comparable).toBe(false);
    expect(d.delta).toBeNull();
    expect(d.reason).toBeTruthy();
  });
  it('名次缺失 → 不可比', () => {
    const prev = sc('e1', '数学', null, null, pool2);
    const curr = sc('e2', '数学', null, 9, pool2);
    expect(rankDelta(prev, curr).comparable).toBe(false);
  });
  it('缺数据 → 不可比', () => {
    expect(rankDelta(undefined, sc('e2', '数学', null, 9, pool2)).comparable).toBe(false);
  });
});

describe('findScore / subjectScores', () => {
  const scores: Score[] = [
    sc('e1', '语文', 77, 18),
    sc('e1', '数学', 98, 2, pool2),
    sc('e1', '总分', 313, 9),
  ];
  it('findScore 命中', () => {
    expect(findScore(scores, 's1', 'e1', '数学')?.raw).toBe(98);
  });
  it('findScore 不命中 → undefined', () => {
    expect(findScore(scores, 's1', 'e2', '数学')).toBeUndefined();
  });
  it('subjectScores 排除总分行', () => {
    expect(subjectScores(scores, 's1', 'e1')).toHaveLength(2);
  });
});
