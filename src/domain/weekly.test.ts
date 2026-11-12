import { describe, expect, it } from 'vitest';
import { recordsOf, weekOf, weeklyRegister, weeklySummary } from './weekly';
import type { Exam, RecordItem, Score, Student } from './types';

function stu(id: string): Student {
  return { id, name: `学生${id}`, classId: '10', advisor: '王老师' };
}

let seq = 0;
function rec(studentId: string, date: string, type = '沟通', content = '内容'): RecordItem {
  seq += 1;
  const ss = String(seq).padStart(2, '0');
  return {
    id: `${studentId}-${date}-${type}-${seq}`,
    studentId,
    date,
    type,
    content,
    createdAt: `${date}T10:00:${ss}`,
  };
}

function score(studentId: string, examId: string, subject: string, raw: number | null, rank: number | null): Score {
  return {
    studentId, examId, subject, raw, rank,
    pool: { subject, tier: null, scope: 'grade' },
  };
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

describe('weeklyRegister', () => {
  const students = [stu('s1'), stu('s2')];
  const exams: Exam[] = [
    { id: 'e1', label: '上次', date: '', order: 1 },
    { id: 'e2', label: '期中', date: '', order: 2 },
  ];
  const scores: Score[] = [
    score('s1', 'e2', '语文', 88, 5),
    score('s1', 'e2', '数学', 92, 3),
    score('s1', 'e2', '总分', 180, 4),
    score('s2', 'e2', '语文', 70, 30),
    score('s2', 'e2', '总分', null, null),
  ];
  // 2026-11-09 是周一
  const records: RecordItem[] = [
    rec('s1', '2026-11-09', '沟通', '电话联系家长'),
    rec('s1', '2026-11-10', '谈心', '办公室谈作业'),
    rec('s1', '2026-11-10', '沟通', '第二次沟通'),
    rec('s2', '2026-11-06', '沟通', '上周的不算'),
  ];

  it('每人一行：次数按类型、摘要取最近一条', () => {
    const { rows } = weeklyRegister(students, records, scores, exams, '2026-11-12');
    const s1 = rows.find((r) => r.student.id === 's1')!;
    expect(s1.countByType.get('沟通')).toBe(2);
    expect(s1.countByType.get('谈心')).toBe(1);
    expect(s1.count).toBe(3);
    expect(s1.summary).toBe('第二次沟通');
  });
  it('最近成绩：order 最大的考试 + 池标签', () => {
    const { rows } = weeklyRegister(students, records, scores, exams, '2026-11-12');
    const s1 = rows.find((r) => r.student.id === 's1')!;
    expect(s1.total).toBe(180);
    expect(s1.rank).toBe(4);
    expect(s1.poolLabel).toBe('全年级');
  });
  it('本周无记录的学生：count=0、summary 为空、成绩仍显示', () => {
    const { rows } = weeklyRegister(students, records, scores, exams, '2026-11-12');
    const s2 = rows.find((r) => r.student.id === 's2')!;
    expect(s2.count).toBe(0);
    expect(s2.summary).toBe('');
    expect(s2.total).toBe(70); // 只有语文一门
  });
});
