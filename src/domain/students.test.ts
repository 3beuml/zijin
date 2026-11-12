import { describe, expect, it } from 'vitest';
import { distinctAdvisors, filterStudents, myStudents } from './students';
import type { Student } from './types';

function s(id: string, advisor: string): Student {
  return { id, name: `学生${id}`, classId: '10', advisor };
}

describe('myStudents / distinctAdvisors', () => {
  const students = [s('1', '王子柔'), s('2', '李迎莉'), s('3', '王子柔'), s('4', '')];
  it('分包 = advisor 精确匹配', () => {
    expect(myStudents(students, '王子柔').map((x) => x.id)).toEqual(['1', '3']);
  });
  it('未设置导师 → 空数组（提示先设置，不默认全班）', () => {
    expect(myStudents(students, '')).toEqual([]);
  });
  it('导师去重排序', () => {
    expect(distinctAdvisors(students)).toEqual(['李迎莉', '王子柔']);
  });
});

describe('filterStudents', () => {
  const students = [s('1', '王子柔'), s('2', '李迎莉'), s('3', '王子柔'), s('4', '王子柔')];
  const contacted = new Set(['1']); // 学生1 本周已联系
  it('分包范围', () => {
    const r = filterStudents(students, { scope: 'mine', advisor: '王子柔', keyword: '', onlyUncovered: false, contactedThisWeek: contacted });
    expect(r.map((x) => x.id)).toEqual(['1', '3', '4']);
  });
  it('本周未联系', () => {
    const r = filterStudents(students, { scope: 'mine', advisor: '王子柔', keyword: '', onlyUncovered: true, contactedThisWeek: contacted });
    expect(r.map((x) => x.id)).toEqual(['3', '4']);
  });
  it('关键词搜姓名', () => {
    const r = filterStudents(students, { scope: 'all', advisor: '', keyword: '学生2', onlyUncovered: false, contactedThisWeek: contacted });
    expect(r.map((x) => x.id)).toEqual(['2']);
  });
  it('组合条件', () => {
    const r = filterStudents(students, { scope: 'all', advisor: '', keyword: '', onlyUncovered: false, contactedThisWeek: contacted });
    expect(r).toHaveLength(4);
  });
});
