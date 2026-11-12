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

/** 列表过滤：关键词（姓名/导师）+ 仅看本周未联系 */
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
  return list;
}
