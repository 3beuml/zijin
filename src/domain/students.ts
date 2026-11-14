/**
 * 分包视角：「在 33 个孩子里看见那 16 个」。
 * 分包 = 学生.advisor === settings.advisor；是可编辑的标记，不是硬编码名单。
 */
import type { Student } from './types.ts';

/** 我的学生（分包）；advisor 为空时返回空数组（提示先设置） */
export function myStudents(students: Student[], advisor: string): Student[] {
  if (!advisor) return [];
  return students.filter((s) => s.advisor === advisor);
}

/** 全库里出现过的导师（分包设置的下拉选项） */
export function distinctAdvisors(students: Student[]): string[] {
  const set = new Set<string>();
  for (const s of students) {
    if (s.advisor) set.add(s.advisor);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh'));
}

/** 列表过滤：关键词（姓名/导师）+ 仅看本周未联系 + 性别/宿舍/标签（v0.6，teacher §5.2 筛选项） */
export interface ListFilter {
  scope: 'mine' | 'all';
  advisor: string;
  keyword: string;
  onlyUncovered: boolean;
}

export function filterStudents(
  students: Student[],
  options: {
    scope: 'mine' | 'all';
    advisor: string;
    keyword: string;
    onlyUncovered: boolean;
    contactedThisWeek: Set<string>;
    /** 空串 = 不限 */
    gender?: '' | '男' | '女';
    dorm?: string;
    tag?: string;
  },
): Student[] {
  let list = students;
  if (options.scope === 'mine' && options.advisor) {
    list = myStudents(list, options.advisor);
  }
  const kw = options.keyword.trim();
  if (kw) {
    list = list.filter((s) => s.name.includes(kw) || s.advisor.includes(kw));
  }
  if (options.onlyUncovered) {
    list = list.filter((s) => !options.contactedThisWeek.has(s.id));
  }
  if (options.gender) {
    list = list.filter((s) => s.gender === options.gender);
  }
  if (options.dorm) {
    list = list.filter((s) => s.dorm === options.dorm);
  }
  if (options.tag) {
    list = list.filter((s) => (s.tags ?? []).includes(options.tag!));
  }
  return list;
}

/**
 * 按最近一次记录时间排序（teacher §5.2「最近沟通时间」排序）。
 * 有记录的在前（新在前），没记录的排后面且保持原有相对顺序——稳定排序。
 */
export function sortByRecentRecord<T extends { id: string }>(
  students: T[],
  records: { studentId: string; date: string; createdAt?: string }[],
): T[] {
  const last = new Map<string, string>();
  for (const r of records) {
    const key = `${r.date}|${r.createdAt ?? ''}`;
    if (!last.has(r.studentId) || key > last.get(r.studentId)!) last.set(r.studentId, key);
  }
  return students
    .map((s, i) => ({ s, i, k: last.get(s.id) ?? '' }))
    .sort((a, b) => {
      if (a.k && b.k) return b.k.localeCompare(a.k) || a.i - b.i;
      if (a.k) return -1;
      if (b.k) return 1;
      return a.i - b.i;
    })
    .map((x) => x.s);
}
