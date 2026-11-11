/**
 * 名次计算：仅在「导入范围内」现算，用 scope='class' 标注（表里没给名次时的兜底）。
 * 同分同名次（中国学校惯例：1,1,3）。
 */
import type { RankPool, Score } from './types.ts';
import { poolKey } from './pool.ts';

export interface RankInput {
  studentId: string;
  raw: number;
}

/** 给一组同池分数计算名次，返回 studentId → rank */
export function computeRanks(entries: RankInput[]): Map<string, number> {
  const sorted = [...entries].sort((a, b) => b.raw - a.raw);
  const out = new Map<string, number>();
  let lastRaw: number | null = null;
  let lastRank = 0;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (lastRaw !== null && e.raw === lastRaw) {
      out.set(e.studentId, lastRank); // 同分同名次
    } else {
      const rank = i + 1; // 标准竞赛排名：1,1,3
      out.set(e.studentId, rank);
      lastRank = rank;
      lastRaw = e.raw;
    }
  }
  return out;
}

/**
 * 校验已导入分数在池内的单调性：同池内 raw 更高者 rank 必须不更大。
 * 返回逆序描述列表（最多 limit 条）。
 */
export function findPoolInversions(
  scores: Score[],
  limit = 3,
): { poolKey: string; desc: string }[] {
  const pools = new Map<string, Score[]>();
  for (const s of scores) {
    if (s.raw == null || s.rank == null) continue;
    const k = poolKey(s.pool);
    if (!pools.has(k)) pools.set(k, []);
    pools.get(k)!.push(s);
  }
  const out: { poolKey: string; desc: string }[] = [];
  for (const [k, arr] of pools) {
    arr.sort((a, b) => b.raw! - a.raw!);
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[i];
      const b = arr[i + 1];
      if (a.raw! > b.raw! && a.rank! > b.rank!) {
        out.push({
          poolKey: k,
          desc: `${a.raw}/${a.rank} → ${b.raw}/${b.rank}`,
        });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

/** 名次带池的展示已在 pool.rankText；这里做分数行的默认池构造 */
export function makePool(subject: string, tier: RankPool['tier'], scope: RankPool['scope']): RankPool {
  return { subject, tier, scope };
}
