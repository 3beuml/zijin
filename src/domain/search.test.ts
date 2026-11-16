import { describe, expect, it } from 'vitest';
import { searchAll } from './search';
import type { AppData } from './types';

const data: AppData = {
  version: 1,
  settings: { advisor: '' },
  attendance: [],
  homework: [],
  students: [
    { id: 's1', name: '张伟', classId: '10', advisor: '王老师', tags: ['临界生'], dorm: '5号楼201', note: '数学有潜力' },
    { id: 's2', name: '王芳', classId: '10', advisor: '李老师' },
  ],
  exams: [],
  scores: [],
  records: [
    { id: 'r1', studentId: 's1', date: '2026-11-10', type: '沟通', content: '电话聊手机管控', createdAt: '2026-11-10T10:00:00' },
    { id: 'r2', studentId: 's2', date: '2026-11-11', type: '谈心', content: '聊期中目标', createdAt: '2026-11-11T10:00:00' },
  ],
  todos: [
    { id: 't1', title: '回访张伟家长', type: '家校', priority: 'mid', due: '2026-11-18', status: 'open', createdAt: '2026-11-12T00:00:00' },
    { id: 't2', title: '交材料', type: '行政', priority: 'low', due: '2026-11-10', status: 'done', createdAt: '2026-11-12T00:00:00' },
  ],
};

describe('searchAll', () => {
  it('搜学生姓名 → 命中学生 + 其关联记录', () => {
    const r = searchAll(data, '张伟');
    expect(r.students.map((s) => s.id)).toEqual(['s1']);
    expect(r.records.map((x) => x.id)).toEqual(['r1']);
    expect(r.todos.map((t) => t.id)).toEqual(['t1']);
  });
  it('搜记录内容关键词', () => {
    const r = searchAll(data, '手机');
    expect(r.records.map((x) => x.id)).toEqual(['r1']);
    expect(r.students).toHaveLength(0);
  });
  it('搜标签 / 宿舍 / 备注', () => {
    expect(searchAll(data, '临界生').students.map((s) => s.id)).toEqual(['s1']);
    expect(searchAll(data, '5号楼').students.map((s) => s.id)).toEqual(['s1']);
    expect(searchAll(data, '潜力').students.map((s) => s.id)).toEqual(['s1']);
  });
  it('搜待办标题', () => {
    expect(searchAll(data, '回访').todos.map((t) => t.id)).toEqual(['t1']);
  });
  it('空关键词 → 空', () => {
    const r = searchAll(data, '   ');
    expect(r.students).toHaveLength(0);
    expect(r.records).toHaveLength(0);
  });
  it('记录按时间倒序、待办未完成在前', () => {
    const r = searchAll(data, '聊');
    expect(r.records.map((x) => x.id)).toEqual(['r2', 'r1']);
    const both = searchAll(data, '交材料');
    expect(both.todos.map((t) => t.status)).toEqual(['done']);
  });
});
