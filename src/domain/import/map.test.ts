import { describe, expect, it } from 'vitest';
import { readTable } from '../../../scripts/lib/read-table.mjs';
import { detect } from './detect';
import { map } from './map';
import type { Cell, ImportTemplate } from './types';

const SAMPLES = 'reference/samples/';

async function load(name: string): Promise<Cell[][]> {
  const { table } = await readTable(`${SAMPLES}sample-${name}.xlsx`);
  return table as Cell[][];
}

describe('map · 启发式', () => {
  it('standard：无模板时给出完整映射，examLabels 从标题提取', async () => {
    const table = await load('messy');
    const m = map(table, detect(table));
    expect(m.matchedTemplate).toBeNull();
    expect(m.examLabels[2]).toBe('期中'); // 标题行「……期中考试成绩表」
    expect(m.columns.find((c) => c.index === 1)?.role).toBe('student.name');
    expect(m.columns.find((c) => c.index === 6)?.role).toBe('exam.total');
  });

  it('broken：姓名列表头为空 → 兜底猜测列 1 为姓名（低置信度 + 警告）', async () => {
    const table = await load('broken');
    const m = map(table, detect(table));
    const nameCol = m.columns.find((c) => c.role === 'student.name');
    expect(nameCol?.index).toBe(1);
    expect(nameCol?.source).toBe('fallback');
    expect(nameCol!.confidence).toBeLessThan(0.5);
    expect(m.warnings.some((w) => w.includes('姓名'))).toBe(true);
  });
});

describe('map · 模板优先', () => {
  const template: ImportTemplate = {
    name: '某校期中表 v1',
    match: {
      columns: ['姓名', '语文', '数学', '英语', '总分', '班名'],
      headerRows: 1,
    },
    mapping: [
      { col: 1, role: 'student.name' },
      { col: 2, role: 'subject.score', subject: '语文', attempt: 2 },
      { col: 3, role: 'subject.score', subject: '数学', attempt: 2 },
      { col: 4, role: 'subject.score', subject: '英语', attempt: 2 },
      { col: 5, role: 'exam.total', attempt: 2 },
      { col: 6, role: 'exam.rank', poolScope: 'class', attempt: 2 },
    ],
  };

  it('表头全一致 → 命中模板，置信度 1', async () => {
    const table = await load('flat');
    const m = map(table, detect(table), [template]);
    expect(m.matchedTemplate).toBe('某校期中表 v1');
    expect(m.columns.every((c) => c.confidence === 1)).toBe(true);
    expect(m.columns.find((c) => c.index === 6)?.poolScope).toBe('class');
  });

  it('表头不一致 → 落回启发式', async () => {
    const table = await load('standard');
    const m = map(table, detect(table), [template]);
    expect(m.matchedTemplate).toBeNull();
    expect(m.columns.find((c) => c.index === 1)?.role).toBe('student.name');
  });
});
