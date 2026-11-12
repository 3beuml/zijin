/**
 * 记录的查询与过滤（全局记录页用）。
 * 记录本身不可变——编辑 = 用新值替换（UI 层做），这里只管查。
 */
import type { RecordItem } from './types.ts';

/** 统一时间线：按日期倒序，同日按 createdAt 倒序 */
export function allRecords(records: RecordItem[]): RecordItem[] {
  return [...records].sort(
    (a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''),
  );
}

export interface RecordFilter {
  type?: string; // 指定类型；不传 = 全部
  keyword?: string; // 匹配内容
  studentId?: string;
}

/** 记录页的组合过滤（类型 + 关键词 + 可选限定学生） */
export function filterRecords(records: RecordItem[], f: RecordFilter = {}): RecordItem[] {
  const kw = (f.keyword ?? '').trim();
  return allRecords(records).filter((r) => {
    if (f.type && r.type !== f.type) return false;
    if (f.studentId && r.studentId !== f.studentId) return false;
    if (kw && !r.content.includes(kw) && !r.type.includes(kw)) return false;
    return true;
  });
}

/** 库里出现过的记录类型（过滤 chips 用），按出现次数降序 */
export function recordTypes(records: RecordItem[]): { type: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) map.set(r.type, (map.get(r.type) ?? 0) + 1);
  return [...map.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type, 'zh'));
}
