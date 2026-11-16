import { describe, expect, it } from 'vitest';
import { homeworkStats, missingStudentsOf } from './homework.ts';
import type { Homework } from './types.ts';

let seq = 0;
const hw = (date: string, statuses: Record<string, Homework['records'][number]['status']>): Homework => {
  seq++;
  return {
    id: `h${seq}`,
    date,
    subject: '数学',
    records: Object.entries(statuses).map(([studentId, status]) => ({ studentId, status })),
    createdAt: `${date}T10:00:00Z`,
  };
};

describe('homework · 作业未交统计（「这周第 3 次没交」）', () => {
  it('未交/迟交分开计数；免交不算没交；漏登记不当作未交', () => {
    const list = [
      hw('2026-11-09', { s1: '未交', s2: '交', s3: '免交' }),
      hw('2026-11-10', { s1: '迟交', s2: '交' }), // s3 漏登记
      hw('2026-11-11', { s1: '未交' }),
    ];
    const s1 = homeworkStats(list, 's1');
    expect(s1.missed).toBe(2);
    expect(s1.late).toBe(1);
    const s3 = homeworkStats(list, 's3');
    expect(s3.missed).toBe(0);
    expect(s3.late).toBe(0);
  });

  it('连续未交 streak：最近连续 3 次未交 → 3；中间交了一次就断', () => {
    const list = [
      hw('2026-11-05', { s1: '未交' }),
      hw('2026-11-06', { s1: '未交' }),
      hw('2026-11-07', { s1: '未交' }),
      hw('2026-11-08', { s1: '交' }),
    ];
    expect(homeworkStats(list, 's1').streak).toBe(0); // 最近一次是「交」
    const list2 = [
      hw('2026-11-05', { s1: '交' }),
      hw('2026-11-06', { s1: '未交' }),
      hw('2026-11-07', { s1: '未交' }),
      hw('2026-11-08', { s1: '未交' }),
    ];
    expect(homeworkStats(list2, 's1').streak).toBe(3);
    expect(homeworkStats(list2, 's1').missed).toBe(3);
  });

  it('迟交延续 streak（迟交也算没交），交/补交/免交断开', () => {
    // 最近是未交，上一次是迟交 → streak 2；再往前补交断开
    const list = [
      hw('2026-11-06', { s1: '迟交' }),
      hw('2026-11-07', { s1: '补交' }),
      hw('2026-11-08', { s1: '未交' }),
    ];
    expect(homeworkStats(list, 's1').streak).toBe(1);
    const list2 = [
      hw('2026-11-06', { s1: '未交' }),
      hw('2026-11-07', { s1: '迟交' }),
      hw('2026-11-08', { s1: '未交' }),
    ];
    expect(homeworkStats(list2, 's1').streak).toBe(3);
  });

  it('latestMissed：最近没交的明细（含日期/科目/状态），最多 3 条', () => {
    const list = [
      hw('2026-11-05', { s1: '未交' }),
      hw('2026-11-06', { s1: '交' }),
      hw('2026-11-07', { s1: '未交' }),
      hw('2026-11-08', { s1: '未交' }),
    ];
    const stats = homeworkStats(list, 's1');
    expect(stats.latestMissed.map((m) => m.date)).toEqual(['2026-11-08', '2026-11-07', '2026-11-05']);
    expect(stats.latestMissed[0].subject).toBe('数学');
    expect(stats.latestMissed[0].status).toBe('未交');
  });

  it('missingStudentsOf：一次作业的未交名单', () => {
    expect(missingStudentsOf(hw('2026-11-09', { s1: '未交', s2: '交', s3: '未交' }))).toEqual(['s1', 's3']);
  });
});
