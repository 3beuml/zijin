import { describe, expect, it } from 'vitest';
import { distinctAdvisors, filterStudents, myStudents, sortByRecentRecord } from './students';
import type { Student } from './types';

function s(id: string, advisor: string): Student {
  return { id, name: `学生${id}`, classId: '10', advisor };
}

describe('myStudents / distinctAdvisors', () => {
  const students = [s('1', '王老师'), s('2', '李老师'), s('3', '王老师'), s('4', '')];
  it('分包 = advisor 精确匹配', () => {
    expect(myStudents(students, '王老师').map((x) => x.id)).toEqual(['1', '3']);
  });
  it('未设置导师 → 空数组（提示先设置，不默认全班）', () => {
    expect(myStudents(students, '')).toEqual([]);
  });
  it('导师去重排序', () => {
    expect(distinctAdvisors(students)).toEqual(['李老师', '王老师']);
  });
});

describe('filterStudents', () => {
  const students = [s('1', '王老师'), s('2', '李老师'), s('3', '王老师'), s('4', '王老师')];
  const contacted = new Set(['1']); // 学生1 本周已联系
  it('分包范围', () => {
    const r = filterStudents(students, { scope: 'mine', advisor: '王老师', keyword: '', onlyUncovered: false, contactedThisWeek: contacted });
    expect(r.map((x) => x.id)).toEqual(['1', '3', '4']);
  });
  it('本周未联系', () => {
    const r = filterStudents(students, { scope: 'mine', advisor: '王老师', keyword: '', onlyUncovered: true, contactedThisWeek: contacted });
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

describe('students · v0.6 筛选与排序（teacher §5.2）', () => {
  const base = [
    { id: 's1', name: '张三', classId: 'c1', advisor: '王', gender: '男' as const, dorm: '1号楼', tags: ['临界生'] },
    { id: 's2', name: '李四', classId: 'c1', advisor: '王', gender: '女' as const, dorm: '2号楼', tags: [] },
    { id: 's3', name: '王五', classId: 'c1', advisor: '李', gender: '男' as const, tags: ['临界生', '手机管控'] },
  ];
  const opts = {
    scope: 'all' as const,
    advisor: '',
    keyword: '',
    onlyUncovered: false,
    contactedThisWeek: new Set<string>(),
  };

  it('按性别筛选', () => {
    expect(filterStudents(base, { ...opts, gender: '女' }).map((s) => s.id)).toEqual(['s2']);
    expect(filterStudents(base, { ...opts, gender: '男' })).toHaveLength(2);
    expect(filterStudents(base, opts)).toHaveLength(3); // 空串 = 不限
  });

  it('按宿舍筛选', () => {
    expect(filterStudents(base, { ...opts, dorm: '1号楼' }).map((s) => s.id)).toEqual(['s1']);
  });

  it('按标签筛选', () => {
    expect(filterStudents(base, { ...opts, tag: '临界生' }).map((s) => s.id)).toEqual(['s1', 's3']);
    expect(filterStudents(base, { ...opts, tag: '手机管控' }).map((s) => s.id)).toEqual(['s3']);
  });

  it('sortByRecentRecord：最近有记录的在前，没记录的在后保持原序', () => {
    const records = [
      { studentId: 's3', date: '2026-11-10', createdAt: '2026-11-10T08:00:00Z' },
      { studentId: 's1', date: '2026-11-11', createdAt: '2026-11-11T08:00:00Z' },
      { studentId: 's1', date: '2026-11-09' },
    ];
    const sorted = sortByRecentRecord(base, records);
    expect(sorted.map((s) => s.id)).toEqual(['s1', 's3', 's2']); // s1 的最新记录 11-11 晚于 s3 的 11-10
  });
});
