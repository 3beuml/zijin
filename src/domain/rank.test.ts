import { describe, expect, it } from 'vitest';
import { computeRanks, findPoolInversions } from './rank';

describe('computeRanks', () => {
  it('同分同名次，下一个名次跳号（1,1,3）', () => {
    const m = computeRanks([
      { studentId: 'a', raw: 90 },
      { studentId: 'b', raw: 90 },
      { studentId: 'c', raw: 85 },
      { studentId: 'd', raw: 80 },
    ]);
    expect(m.get('a')).toBe(1);
    expect(m.get('b')).toBe(1);
    expect(m.get('c')).toBe(3);
    expect(m.get('d')).toBe(4);
  });
  it('空输入 → 空 Map', () => {
    expect(computeRanks([]).size).toBe(0);
  });
  it('全同分 → 全是第 1', () => {
    const m = computeRanks([
      { studentId: 'a', raw: 70 },
      { studentId: 'b', raw: 70 },
      { studentId: 'c', raw: 70 },
    ]);
    expect([...m.values()]).toEqual([1, 1, 1]);
  });
});

describe('findPoolInversions', () => {
  it('池内高分的名次反而更差 → 报逆序', () => {
    const inv = findPoolInversions([
      mk('a', 90, 5),
      mk('b', 95, 8), // 95 分比 90 高，名次 8 却比 5 差 → 逆序
    ]);
    expect(inv).toHaveLength(1);
  });
  it('自洽数据 → 无逆序', () => {
    const inv = findPoolInversions([
      mk('a', 95, 1),
      mk('b', 90, 2),
      mk('c', 85, 3),
      mk('c2', 85, 3), // 同分同名次不算逆序
    ]);
    expect(inv).toHaveLength(0);
  });
  it('raw 或 rank 缺失的行跳过', () => {
    const inv = findPoolInversions([
      mk('a', null, 1),
      mk('b', 90, null),
      mk('c', 80, 2),
    ]);
    expect(inv).toHaveLength(0);
  });
  it('不同池之间不算逆序', () => {
    const inv = findPoolInversions([
      { ...mk('a', 90, 5), pool: { subject: '数学', tier: '2', scope: 'tier' } },
      { ...mk('b', 95, 8), pool: { subject: '数学', tier: '1', scope: 'tier' } },
    ]);
    expect(inv).toHaveLength(0);
  });
});

function mk(
  studentId: string,
  raw: number | null,
  rank: number | null,
): import('./types').Score {
  return {
    studentId,
    examId: 'e1',
    subject: '数学',
    raw,
    rank,
    pool: { subject: '数学', tier: '2', scope: 'tier' },
  };
}
