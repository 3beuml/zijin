import { describe, expect, it } from 'vitest';
import { attendanceOf, attendanceWeekLabel, countByType } from './attendance.ts';
import type { Attendance } from './types.ts';

const att = (over: Partial<Attendance>): Attendance => ({
  id: 'a',
  studentId: 's1',
  date: '2026-11-09',
  type: '迟到',
  createdAt: '2026-11-09T08:00:00Z',
  ...over,
});

describe('attendance · 考勤统计', () => {
  it('attendanceOf：按学生过滤、新在前', () => {
    const items = [
      att({ id: 'a1', studentId: 's1', date: '2026-11-09' }),
      att({ id: 'a2', studentId: 's2', date: '2026-11-10' }),
      att({ id: 'a3', studentId: 's1', date: '2026-11-12' }),
    ];
    const list = attendanceOf(items, 's1');
    expect(list.map((a) => a.id)).toEqual(['a3', 'a1']);
  });

  it('countByType：按类型计数，可限定学生', () => {
    const items = [
      att({ studentId: 's1', type: '迟到' }),
      att({ studentId: 's1', type: '迟到' }),
      att({ studentId: 's1', type: '病假' }),
      att({ studentId: 's2', type: '旷课' }),
    ];
    expect(countByType(items, 's1').get('迟到')).toBe(2);
    expect(countByType(items, 's1').get('病假')).toBe(1);
    expect(countByType(items, 's1').has('旷课')).toBe(false);
    expect(countByType(items).get('旷课')).toBe(1);
  });

  it('attendanceWeekLabel：周内汇总为短标签，周外不计，无考勤为空', () => {
    const items = [
      att({ studentId: 's1', date: '2026-11-09', type: '迟到' }),
      att({ studentId: 's1', date: '2026-11-10', type: '迟到' }),
      att({ studentId: 's1', date: '2026-11-11', type: '病假' }),
      att({ studentId: 's1', date: '2026-11-01', type: '迟到' }), // 上周
    ];
    // 2026-11-09 是周一，11-15 是周日
    expect(attendanceWeekLabel(items, 's1', '2026-11-09', '2026-11-15')).toBe('迟到2 病假');
    expect(attendanceWeekLabel(items, 's2', '2026-11-09', '2026-11-15')).toBe('');
  });
});
