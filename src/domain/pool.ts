/**
 * 排名池：键、标签、同池判断。
 * 铁律：名次只在同池内可比；展示必须带池标签。
 */
import type { RankPool, Tier } from './types.ts';

/** 池的唯一键（存储与比较用） */
export function poolKey(p: RankPool): string {
  return `${p.subject}|${p.tier ?? 'all'}|${p.scope}`;
}

/** 池标签：用于「二层内第 5 名」的前半段 */
export function poolLabel(p: RankPool): string {
  switch (p.scope) {
    case 'tier':
      return p.tier ? `${p.tier}层内` : '层内';
    case 'class':
      return '班内';
    case 'grade':
    default:
      return '全年级';
  }
}

/** 带池标签的完整名次文本，如「二层内第 5 名」 */
export function rankText(pool: RankPool, rank: number | null): string {
  if (rank == null) return '—';
  return `${poolLabel(pool)}第 ${rank} 名`;
}

export function samePool(a: RankPool, b: RankPool): boolean {
  return a.subject === b.subject && a.tier === b.tier && a.scope === b.scope;
}

/**
 * 从分层单元格文本解析层号：'3区1A' → '1'，'2层' → '2'，'2B' → '2'。
 * 解析不出返回 null（该生此科目按不分层处理并给 warning）。
 */
export function parseTierLabel(s: string): Tier | null {
  const t = String(s ?? '').trim();
  if (!t) return null;
  // 常见形态：{区号}区{层}{AB} → 取 A/B 前面的层号；{层}层 → 取「层」前面的数字
  let m = t.match(/([12])\s*[ABab]\s*$/);
  if (m) return m[1] as Tier;
  m = t.match(/([12])\s*层/);
  if (m) return m[1] as Tier;
  return null;
}
