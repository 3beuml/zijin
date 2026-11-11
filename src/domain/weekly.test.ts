import { describe, expect, it } from 'vitest';
import { recordsOf, weekOf, weeklySummary } from './weekly';
import type { RecordItem, Student } from './types';

function stu(id: string): Student {
  return { id, name: `学生${id}`, classId: 'c1', advisor: '王老师' };
}

function rec(studentId: string, date: string): RecordItem {
  return { id: `${studentId}-${date}`, studentId, date, type: '沟通', content: 'x', createdAt: `${date}T10:00:00` };
}

describe('weekOf', () => {
  it('周一 → 本周一到周日', () => {
    expect(weekOf('2026-11-09')).toEqual({ start: '2026-11-09', end: '2026-11-15' }); // 2026-11-09 是周一
  });
  it('周日 → 本周一到上周日对齐的一周', () => {
    expect(weekOf('2026-11-15')).toEqual({ start: '2026-11-09', end: '2026-11-15' });
  });
  it('周中 → 归到本周一', () => {
    expect(weekOf('2026-11-11')).toEqual({ start: '2026-11-09', end: '2026-11-15' });
  });
  it('跨月不串行', () => {
    expect(weekOf('2026-11-01')).toEqual({ start: '2026-10-26', end: '2026-11-01' }); // 2026-11-01 是周日
  });
  it('跨年不串行', () => {
    expect(weekOf('2027-01-01')).toEqual({ start: '2026-12-28', end: '2027-01-03' }); // 2027-01-01 是周五
  });
});

describe('weeklySummary', () => {
  const students = [stu('s1'), stu('s2'), stu('s3')];
  it('统计本周覆盖与未覆盖名单', () => {
    const records = [rec('s1', '2026-11-09'), rec('s1', '2026-11-10'), rec('s2', '2026-11-08')];
    const w = weeklySummary(students, records, '2026-11-11');
    expect(w.start).toBe('2026-11-09');
    expect(w.total).toBe(3);
    expect(w.covered).toBe(1); // 只有 s1 在本周内
    expect(w.countByStudent.get('s1')).toBe(2);
    expect(w.uncovered.map((s) => s.id).sort()).toEqual(['s2', 's3']);
  });
  it('上周的记录不算本周', () => {
    const records = [rec('s1', '2026-11-06')]; // 上周五
    const w = weeklySummary(students, records, '2026-11-11');
    expect(w.covered).toBe(0);
  });
  it('空记录 → 全部未覆盖', () => {
    const w = weeklySummary(students, [], '2026-11-11');
    expect(w.covered).toBe(0);
    expect(w.uncovered).toHaveLength(3);
  });
});

describe('recordsOf', () => {
  it('按 createdAt 倒序（新在前）', () => {
    const records = [
      { ...rec('s1', '2026-11-09'), createdAt: '2026-11-09T08:00:00' },
      { ...rec('s1', '2026-11-10'), createdAt: '2026-11-10T09:00:00' },
      rec('s2', '2026-11-10'),
    ];
    const rs = recordsOf(records, 's1');
    expect(rs).toHaveLength(2);
    expect(rs[0].date).toBe('2026-11-10');
    expect(rs[1].date).toBe('2026-11-09');
  });
});
