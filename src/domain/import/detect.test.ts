/**
 * T1 闸门：五条判据直接写成单测（docs/handoff.md）。
 * 样例文件是**虚构**的，可以进仓库、可以进 CI。
 */
import { describe, expect, it } from 'vitest';
import { readTable } from '../../../scripts/lib/read-table.mjs';
import { detect } from './detect';
import type { Cell } from './types';

const SAMPLES = 'reference/samples/';

async function load(name: string): Promise<Cell[][]> {
  const { table } = await readTable(`${SAMPLES}sample-${name}.xlsx`);
  return table as Cell[][];
}

describe('T1 判据 1：sample-standard', () => {
  it('headerRows=1；22 列全覆盖；4 个科目组；2 个 tier 列；1 个派生列', async () => {
    const sketch = detect(await load('standard'));
    expect(sketch.headerRows).toBe(1);
    expect(sketch.columns).toHaveLength(22);
    expect(sketch.columns.map((c) => c.index)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
    expect(sketch.subjectGroups.map((g) => g.subject)).toEqual(['语文', '数学', '英语', '物理']);
    const tierCols = sketch.columns.filter((c) => c.role === 'tier');
    expect(tierCols.map((c) => c.subject)).toEqual(['数学', '英语']);
    expect(sketch.derivedColumns).toHaveLength(1);
    expect(sketch.derivedColumns[0].header).toContain('浮动');
    // 数学组四件套齐全
    const math = sketch.subjectGroups.find((g) => g.subject === '数学')!;
    expect(math.columns).toEqual({ tier: 11, rankPrev: 12, score: 13, rank: 14 });
  });
  it('重复列名「级名2」按位置归到最近的科目前缀，并给 warning', async () => {
    const sketch = detect(await load('standard'));
    expect(sketch.warnings.some((w) => w.includes('级名2') && w.includes('10/14/18/21'))).toBe(true);
    // 4 个裸「级名2」分别归入四个科目
    const attached = sketch.columns.filter((c) => c.header.includes('级名2'));
    expect(attached.map((c) => c.subject)).toEqual(['语文', '数学', '英语', '物理']);
  });
});

describe('T1 判据 2：sample-flat', () => {
  it('headerRows=1；3 个科目组；没有 tier 列', async () => {
    const sketch = detect(await load('flat'));
    expect(sketch.headerRows).toBe(1);
    expect(sketch.subjectGroups).toHaveLength(3);
    expect(sketch.columns.some((c) => c.role === 'tier')).toBe(false);
    expect(sketch.columns.some((c) => c.role === 'student.name')).toBe(true);
  });
});

describe('T1 判据 3：sample-messy', () => {
  it('headerRows=3；跳过标题行与末尾合计行', async () => {
    const sketch = detect(await load('messy'));
    expect(sketch.headerRows).toBe(3);
    expect(sketch.titleText).toContain('期中');
    expect(sketch.dataStartRow).toBe(4);
    expect(sketch.dataEndRow).toBe(36); // 37 行里最后一行是「班级平均」
    expect(sketch.warnings.some((w) => w.includes('班级平均'))).toBe(true);
  });
});

describe('T1 判据 4：sample-broken', () => {
  it('不抛异常；warnings 指出姓名列缺失；报告重复行/空行/文本分数', async () => {
    const sketch = detect(await load('broken'));
    expect(sketch.warnings.some((w) => w.includes('姓名'))).toBe(true);
    expect(sketch.warnings.some((w) => w.includes('重复行'))).toBe(true);
    expect(sketch.warnings.some((w) => w.includes('空行'))).toBe(true);
    expect(sketch.warnings.some((w) => w.includes('缺考'))).toBe(true);
  });
});

describe('T1 判据 5：任意输入', () => {
  it('四份样例的 columns 都覆盖全部列、无遗漏，输出可 JSON 化', async () => {
    for (const name of ['standard', 'flat', 'messy', 'broken']) {
      const sketch = detect(await load(name));
      const idx = sketch.columns.map((c) => c.index).sort((a, b) => a - b);
      expect(idx, name).toEqual(Array.from({ length: idx.length }, (_, i) => i + 1));
      expect(() => JSON.stringify(sketch), name).not.toThrow();
    }
  });
  it('空表不崩', () => {
    const sketch = detect([]);
    expect(sketch.columns).toHaveLength(0);
    expect(sketch.warnings.length).toBeGreaterThan(0);
  });
});

describe('detect 细节', () => {
  it('次别后缀：总分1 是第 1 次，分数2 是第 2 次', async () => {
    const sketch = detect(await load('standard'));
    const total1 = sketch.columns.find((c) => c.header === '总分1')!;
    expect(total1.role).toBe('exam.total');
    expect(total1.attempt).toBe(1);
    const score2 = sketch.columns.find((c) => c.header === '语文分数2')!;
    expect(score2.role).toBe('subject.score');
    expect(score2.attempt).toBe(2);
    const rankPrev = sketch.columns.find((c) => c.header === '语文级名1')!;
    expect(rankPrev.role).toBe('subject.rankPrev');
  });
});
