import { describe, expect, it } from 'vitest';
import { examStats, studentTotals } from './analytics';
import type { Exam, Score, Student } from './types';

function stu(id: string, name: string): Student {
  return { id, name, classId: '10', advisor: '王老师' };
}

function sc(studentId: string, subject: string, raw: number | null, rank: number | null): Score {
  return {
    studentId, examId: 'e1', subject, raw, rank,
    pool: { subject, tier: null, scope: 'grade' },
  };
}

const students = [stu('s1', '张伟'), stu('s2', '王芳'), stu('s3', '李娜')];
const exams: Exam[] = [{ id: 'e1', label: '期中', date: '', order: 2 }];
const scores: Score[] = [
  sc('s1', '语文', 88, 5),
  sc('s1', '数学', 92, 3),
  sc('s1', '总分', 180, 4),
  sc('s2', '语文', 70, 30),
  sc('s2', '数学', 80, 20),
  sc('s2', '总分', 150, 25),
  sc('s3', '语文', 90, 2),
  sc('s3', '数学', null, null), // 缺考
  sc('s3', '总分', 90, 38), // 语文单科
];

describe('examStats', () => {
  const stats = examStats(scores, exams, students, 'e1')!;
  it('单科均分：不含缺考', () => {
    const chinese = stats.subjects.find((s) => s.subject === '语文')!;
    expect(chinese).toEqual({ subject: '语文', count: 3, avg: 82.7, max: 90, min: 70 });
    const math = stats.subjects.find((s) => s.subject === '数学')!;
    expect(math.count).toBe(2);
    expect(math.avg).toBe(86);
  });
  it('班均总分：180+150+90 → 140', () => {
    expect(stats.totalAvg).toBe(140);
    expect(stats.totalMax).toBe(180);
  });
  it('前三名带池标签', () => {
    expect(stats.top3.map((t) => t.name)).toEqual(['张伟', '王芳', '李娜']);
    expect(stats.top3[0]).toMatchObject({ total: 180, rank: 4, poolLabel: '全年级' });
  });
  it('不存在的考试 → null', () => {
    expect(examStats(scores, exams, students, 'e9')).toBeNull();
  });
});

describe('studentTotals', () => {
  it('每生一行：总分/名次/与班均差', () => {
    const { rows, totalAvg } = studentTotals(scores, exams, students, 'e1');
    expect(totalAvg).toBe(140);
    const zhang = rows.find((r) => r.studentId === 's1')!;
    expect(zhang).toMatchObject({ name: '张伟', total: 180, rank: 4, vsAvg: 40 });
    const li = rows.find((r) => r.studentId === 's3')!;
    expect(li.vsAvg).toBe(-50);
  });
});
