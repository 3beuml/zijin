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

const empty: AppData = {
  version: 1,
  students: [],
  exams: [],
  scores: [],
  records: [],
  todos: [],
  attendance: [],
  homework: [],
  settings: { advisor: '' },
};

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
    expect(new Set(data.students.map((s) => s.advisor))).toEqual(new Set(['王老师', '李老师']));
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

  it('再次导入同一张表：学生按姓名+班级合并，不重复建人；分数同键替换不翻倍', async () => {
    const first = await runStandard();
    const table = await load('standard');
    const m = map(table, detect(table), [], { defaultExamLabel: '期中' });
    const second = commit(first.data, table, m, { examLabels: { 1: '上次', 2: '期中' } });
    expect(second.data.students).toHaveLength(33);
    expect(second.report.studentsMatched).toBe(33);
    expect(second.report.studentsCreated).toBe(0);
    expect(second.data.exams).toHaveLength(2); // 按 label 复用
    expect(second.report.scoresWritten).toBe(0); // 无新增
    expect(second.report.scoresUpdated).toBe(330); // 全部同键替换
    // 关键判据：不产生重复分数行，总分不翻倍
    const seen = new Set<string>();
    for (const s of second.data.scores) {
      const key = `${s.studentId}|${s.examId}|${s.subject}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
    expect(second.data.scores).toHaveLength(first.data.scores.length);
    const total = second.data.scores.find(
      (s) => s.studentId === first.data.students[0].id && s.subject === '总分' && s.examId === second.data.exams[1].id,
    );
    const totalBefore = first.data.scores.find(
      (s) => s.studentId === first.data.students[0].id && s.subject === '总分' && s.examId === first.data.exams[1].id,
    );
    expect(total?.raw).toBe(totalBefore?.raw); // 重导不改变总分
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

  it('全角数字（８８．５）按数字导入', () => {
    const table: Cell[][] = [
      ['姓名', '语文'],
      ['张三', '８８．５'],
    ];
    const m = map(table, detect(table));
    const { data } = commit(empty, table, m);
    const zhang = data.students.find((s) => s.name === '张三')!;
    expect(data.scores.find((s) => s.studentId === zhang.id)!.raw).toBe(88.5);
  });

  it('「缺考」等显式标记 → 缺考（raw=null），并有对应警告', () => {
    const table: Cell[][] = [
      ['姓名', '语文'],
      ['张三', '缺考'],
      ['李四', 90],
    ];
    const m = map(table, detect(table));
    const { data, report } = commit(empty, table, m);
    const zhang = data.students.find((s) => s.name === '张三')!;
    expect(data.scores.find((s) => s.studentId === zhang.id)!.raw).toBeNull();
    expect(report.warnings.some((w) => w.includes('缺考标记'))).toBe(true);
  });
});

describe('commit · 重导刷新语义（v0.5）', () => {
  it('重导后：本次未覆盖的旧科目分数被丢弃（不混进总分）', async () => {
    // 第一次：语文 + 化学
    const t1: Cell[][] = [
      ['姓名', '语文', '化学'],
      ['张三', 80, 70],
      ['李四', 90, 60],
    ];
    const m1 = map(t1, detect(t1));
    const first = commit(empty, t1, m1, { examLabels: { 2: '期中' } });
    expect(first.data.scores.some((s) => s.subject === '化学')).toBe(true);

    // 第二次：同一考试名，但表里只有语文（没有化学列）
    const t2: Cell[][] = [
      ['姓名', '语文'],
      ['张三', 85],
      ['李四', 95],
    ];
    const m2 = map(t2, detect(t2));
    const second = commit(first.data, t2, m2, { examLabels: { 2: '期中' } });
    expect(second.data.scores.some((s) => s.subject === '化学')).toBe(false);
    expect(second.report.warnings.some((w) => w.includes('化学'))).toBe(true);
    // 总分 = 语文（85），不是 85+70
    const zhang = second.data.students.find((s) => s.name === '张三')!;
    const total = second.data.scores.find(
      (s) => s.studentId === zhang.id && s.subject === '总分',
    )!;
    expect(total.raw).toBe(85);
  });

  it('上次考试已有完整分数（raw 非 null）时，重导名次只更新 rank，不抹掉 raw', () => {
    const prevExam = { id: 'e1', label: '月考', date: '', order: 1 };
    const stu = { id: 's1', name: '张三', classId: 'c1', advisor: '' };
    const base: AppData = {
      version: 1,
      students: [stu],
      exams: [prevExam],
      scores: [
        { studentId: 's1', examId: 'e1', subject: '语文', raw: 90, rank: 5, pool: { subject: '语文', tier: null, scope: 'grade' } },
        { studentId: 's1', examId: 'e1', subject: '总分', raw: 90, rank: 5, pool: { subject: '总分', tier: null, scope: 'grade' } },
      ],
      records: [],
      todos: [],
      attendance: [],
      homework: [],
      settings: { advisor: '' },
    };
    const table: Cell[][] = [
      ['姓名', '语文级名1', '语文'],
      ['张三', 3, 88],
    ];
    const m = map(table, detect(table));
    const { data, report } = commit(base, table, m, { examLabels: { 1: '月考', 2: '期中' } });
    const prevRow = data.scores.find((s) => s.examId === 'e1' && s.subject === '语文')!;
    expect(prevRow.raw).toBe(90); // 旧分数保留
    expect(prevRow.rank).toBe(3); // 名次更新
    expect(report.scoresUpdated).toBeGreaterThan(0);
  });
});

describe('commit · 多班级成绩表（逐行班级）', () => {
  it('带班级列的年级表：学生进各自的班；无名次列时按班级现算「班内」名次', () => {
    const table: Cell[][] = [
      ['姓名', '班级', '语文'],
      ['张三', '1班', 90],
      ['李四', '1班', 85],
      ['王五', '2班', 95],
      ['赵六', '2班', 70],
    ];
    const m = map(table, detect(table));
    const { data, report } = commit(empty, table, m);
    const classOf = (n: string): string => data.students.find((s) => s.name === n)!.classId;
    expect(classOf('张三')).toBe('1班');
    expect(classOf('王五')).toBe('2班');
    // 班内现算：张三是 1 班第 1；王五是 2 班第 1（不是全表第 1）
    const rankOf = (n: string): number => {
      const stu = data.students.find((s) => s.name === n)!;
      return data.scores.find((s) => s.studentId === stu.id)!.rank!;
    };
    expect(rankOf('张三')).toBe(1);
    expect(rankOf('王五')).toBe(1);
    expect(rankOf('李四')).toBe(2);
    expect(rankOf('赵六')).toBe(2);
    expect(report.warnings.some((w) => w.includes('按各班级现算'))).toBe(true);
  });

  it('同名学生不同班级：分别建人并给出警告（班级写法不一致的提示）', () => {
    const table: Cell[][] = [
      ['姓名', '班级', '语文'],
      ['张三', '10班', 90],
      ['张三', '高一(10)班', 88],
    ];
    const m = map(table, detect(table));
    const { data, report } = commit(empty, table, m);
    expect(data.students).toHaveLength(2);
    expect(report.warnings.some((w) => w.includes('班级不同'))).toBe(true);
  });
});

