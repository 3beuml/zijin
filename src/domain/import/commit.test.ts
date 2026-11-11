import { describe, expect, it } from 'vitest';
import { readTable } from '../../../scripts/lib/read-table.mjs';
import { detect } from './detect';
import { map } from './map';
import { commit } from './commit';
import type { AppData, Score } from '../types.ts';
import type { Cell } from './types.ts';
import { findPoolInversions } from '../rank.ts';

const SAMPLES = 'reference/samples/';

async function load(name: string): Promise<Cell[][]> {
  const { table } = await readTable(`${SAMPLES}sample-${name}.xlsx`);
  return table as Cell[][];
}

const empty: AppData = { version: 1, students: [], exams: [], scores: [], records: [] };

async function runStandard() {
  const table = await load('standard');
  const m = map(table, detect(table), [], { defaultExamLabel: '期中' });
  return commit(empty, table, m, { examLabels: { 1: '上次', 2: '期中' } });
}

describe('commit · sample-standard（外部验收的同一形状）', () => {
  it('33 学生、2 次考试、每人 10 行分数（4 科×2 次 + 总分×2 次）', async () => {
    const { data, report } = await runStandard();
    expect(data.students).toHaveLength(33);
    expect(data.exams).toHaveLength(2);
    expect(data.exams.map((e) => e.label)).toEqual(['上次', '期中']);
    expect(report.scoresWritten).toBe(330);
    expect(report.studentsCreated).toBe(33);
  });

  it('每个学生都有导师（分包）', async () => {
    const { data } = await runStandard();
    expect(data.students.every((s) => s.advisor)).toBe(true);
    expect(new Set(data.students.map((s) => s.advisor))).toEqual(new Set(['王子柔', '李迎莉']));
  });

  it('名次全部带池；数学按层内池、语文按年级池', async () => {
    const { data } = await runStandard();
    const mathTier2 = data.scores.find(
      (s) => s.subject === '数学' && s.pool.tier === '2' && s.pool.scope === 'tier',
    );
    expect(mathTier2).toBeTruthy();
    const chinese = data.scores.find((s) => s.subject === '语文' && s.rank != null)!;
    expect(chinese.pool).toEqual({ subject: '语文', tier: null, scope: 'grade' });
    // 每个有名次的分数都带池
    expect(data.scores.every((s) => s.rank == null || s.pool != null)).toBe(true);
  });

  it('总分为现算值且等于四科之和；表内总分列不做 raw', async () => {
    const { data } = await runStandard();
    const totals = data.scores.filter((s) => s.subject === '总分' && s.raw != null);
    expect(totals).toHaveLength(33);
    for (const t of totals) {
      const parts = data.scores
        .filter(
          (s) => s.studentId === t.studentId && s.examId === t.examId &&
            ['语文', '数学', '英语', '物理'].includes(s.subject),
        )
        .reduce((sum, s) => sum + (s.raw ?? 0), 0);
      expect(Math.abs(parts - (t.raw ?? 0))).toBeLessThan(1e-6);
    }
  });

  it('上次考试：只有名次没有分数（分数列不导入）', async () => {
    const { data } = await runStandard();
    const prevExam = data.exams.find((e) => e.order === 1)!;
    const prevScores = data.scores.filter((s) => s.examId === prevExam.id);
    expect(prevScores.every((s) => s.raw === null)).toBe(true);
    expect(prevScores.every((s) => s.rank != null)).toBe(true);
  });

  it('池内单调（与 accept.mjs 同一判据）', async () => {
    const { data } = await runStandard();
    expect(findPoolInversions(data.scores)).toHaveLength(0);
  });

  it('再次导入同一张表：学生按姓名+班级合并，不重复建人', async () => {
    const first = await runStandard();
    const table = await load('standard');
    const m = map(table, detect(table), [], { defaultExamLabel: '期中' });
    const second = commit(first.data, table, m, { examLabels: { 1: '上次', 2: '期中' } });
    expect(second.data.students).toHaveLength(33);
    expect(second.report.studentsMatched).toBe(33);
    expect(second.report.studentsCreated).toBe(0);
    expect(second.data.exams).toHaveLength(2); // 按 label 复用
    // 分数行是覆盖式追加后同键去重由存储层保证；此处报告不翻倍
    expect(second.report.scoresWritten).toBe(330);
  });
});

describe('commit · 坏数据路径', () => {
  it('broken：兜底姓名列 + 去重 + 缺考 → 可导入且有报告', async () => {
    const table = await load('broken');
    const m = map(table, detect(table));
    const { data, report } = commit(empty, table, m);
    expect(report.studentsCreated).toBe(11); // 12 行去重 1 行
    expect(report.droppedRows.some((d) => d.reason.includes('同名'))).toBe(true);
    // 缺考学生：语文空、总分按现有科目现算
    const absentee = data.students.find((s) => s.name.includes('缺考生'))!;
    const chinese = data.scores.find(
      (s) => s.studentId === absentee.id && s.subject === '语文',
    )!;
    expect(chinese.raw).toBeNull();
    const total = data.scores.find((s) => s.studentId === absentee.id && s.subject === '总分')!;
    expect(total.raw).toBe(178); // 88 + 90
  });

  it('没有姓名列且猜不出 → 拒绝落库，一个字都不写', () => {
    const table: Cell[][] = [
      ['分数', '名次'],
      [88, 3],
      [72.5, 9],
    ];
    const sketch = detect(table);
    const m = map(table, sketch);
    const { data, report } = commit(empty, table, m);
    expect(data).toBe(empty); // 原样返回
    expect(report.scoresWritten).toBe(0);
    expect(report.warnings.some((w) => w.includes('拒绝落库'))).toBe(true);
  });

  it('同名行去重后不再产生重复分数', async () => {
    const table = await load('broken');
    const m = map(table, detect(table));
    const { data } = commit(empty, table, m);
    const seen = new Set<string>();
    for (const s of data.scores) {
      const key = `${s.studentId}|${s.examId}|${s.subject}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });
});

describe('commit · 分数格式', () => {
  it('文本数字按数字导入并计数', async () => {
    const table: Cell[][] = [
      ['姓名', '语文'],
      ['张三', '88.5'],
      ['李四', 90],
    ];
    const m = map(table, detect(table));
    const { data, report } = commit(empty, table, m);
    const zhang = data.students.find((s) => s.name === '张三')!;
    const score = data.scores.find((s) => s.studentId === zhang.id)!;
    expect(score.raw).toBe(88.5);
    expect(report.warnings.some((w) => w.includes('文本形式的数字'))).toBe(true);
  });

  it('无名次列 → 按导入范围现算名次（班内池），同分同名次', async () => {
    const table: Cell[][] = [
      ['姓名', '语文'],
      ['张三', 90],
      ['李四', 90],
      ['王五', 85],
    ];
    const m = map(table, detect(table));
    const { data } = commit(empty, table, m);
    const byName = (n: string): Score => {
      const stu = data.students.find((s) => s.name === n)!;
      return data.scores.find((s) => s.studentId === stu.id)!;
    };
    expect(byName('张三').rank).toBe(1);
    expect(byName('李四').rank).toBe(1);
    expect(byName('王五').rank).toBe(3);
    expect(byName('张三').pool.scope).toBe('class');
  });
});
