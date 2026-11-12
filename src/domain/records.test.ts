import { describe, expect, it } from 'vitest';
import { allRecords, filterRecords, recordTypes } from './records';
import type { RecordItem } from './types';

function r(id: string, studentId: string, date: string, type: string, content: string, time = '10:00:00'): RecordItem {
  return { id, studentId, date, type, content, createdAt: `${date}T${time}` };
}

const records: RecordItem[] = [
  r('a', 's1', '2026-11-10', '沟通', '电话聊作业'),
  r('b', 's2', '2026-11-11', '谈心', '办公室谈状态'),
  r('c', 's1', '2026-11-11', '沟通', '微信跟进', '10:05:00'),
  r('d', 's3', '2026-11-09', '家访', '上门家访'),
];

describe('allRecords', () => {
  it('日期倒序，同日按 createdAt 倒序', () => {
    const out = allRecords(records).map((x) => x.id);
    expect(out).toEqual(['c', 'b', 'a', 'd']);
  });
});

describe('filterRecords', () => {
  it('按类型过滤', () => {
    const out = filterRecords(records, { type: '沟通' });
    expect(out.map((x) => x.id)).toEqual(['c', 'a']);
  });
  it('关键词匹配内容', () => {
    const out = filterRecords(records, { keyword: '作业' });
    expect(out.map((x) => x.id)).toEqual(['a']);
  });
  it('关键词匹配类型', () => {
    const out = filterRecords(records, { keyword: '谈心' });
    expect(out.map((x) => x.id)).toEqual(['b']);
  });
  it('限定学生 + 类型', () => {
    const out = filterRecords(records, { studentId: 's1', type: '沟通' });
    expect(out.map((x) => x.id)).toEqual(['c', 'a']);
  });
  it('无条件 = 全部', () => {
    expect(filterRecords(records)).toHaveLength(4);
  });
});

describe('recordTypes', () => {
  it('按出现次数降序，同数按拼音序', () => {
    const out = recordTypes(records);
    expect(out[0]).toEqual({ type: '沟通', count: 2 });
    expect(out.map((x) => x.type)).toEqual(['沟通', '家访', '谈心']);
  });
});
