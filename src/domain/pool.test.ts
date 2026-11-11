import { describe, expect, it } from 'vitest';
import { parseTierLabel, poolKey, poolLabel, rankText, samePool } from './pool';

describe('parseTierLabel', () => {
  it('解析「3区1A」为 1 层', () => {
    expect(parseTierLabel('3区1A')).toBe('1');
  });
  it('解析「3区2B」为 2 层', () => {
    expect(parseTierLabel('3区2B')).toBe('2');
  });
  it('解析「1A」「2B」', () => {
    expect(parseTierLabel('1A')).toBe('1');
    expect(parseTierLabel('2B')).toBe('2');
  });
  it('解析「2层」「1层」', () => {
    expect(parseTierLabel('2层')).toBe('2');
    expect(parseTierLabel('1层')).toBe('1');
  });
  it('空与无法解析 → null', () => {
    expect(parseTierLabel('')).toBeNull();
    expect(parseTierLabel('   ')).toBeNull();
    expect(parseTierLabel('走读')).toBeNull();
  });
});

describe('池标签与键', () => {
  it('tier 池标签为「N层内」', () => {
    expect(poolLabel({ subject: '数学', tier: '2', scope: 'tier' })).toBe('2层内');
  });
  it('grade 池标签为「全年级」', () => {
    expect(poolLabel({ subject: '语文', tier: null, scope: 'grade' })).toBe('全年级');
  });
  it('class 池标签为「班内」', () => {
    expect(poolLabel({ subject: '数学', tier: null, scope: 'class' })).toBe('班内');
  });
  it('rankText 必须带池标签（不许裸写名次）', () => {
    expect(rankText({ subject: '数学', tier: '2', scope: 'tier' }, 5)).toBe('2层内第 5 名');
    expect(rankText({ subject: '语文', tier: null, scope: 'grade' }, 120)).toBe('全年级第 120 名');
  });
  it('rankText 无名次 → —', () => {
    expect(rankText({ subject: '语文', tier: null, scope: 'grade' }, null)).toBe('—');
  });
  it('poolKey 区分 tier 与 scope', () => {
    expect(poolKey({ subject: '数学', tier: '2', scope: 'tier' })).toBe('数学|2|tier');
    expect(poolKey({ subject: '数学', tier: null, scope: 'grade' })).toBe('数学|all|grade');
  });
  it('samePool：三要素全同才算同池', () => {
    const a = { subject: '数学', tier: '2' as const, scope: 'tier' as const };
    expect(samePool(a, { ...a })).toBe(true);
    expect(samePool(a, { ...a, tier: '1' })).toBe(false);
    expect(samePool(a, { ...a, scope: 'grade' })).toBe(false);
    expect(samePool(a, { ...a, subject: '英语' })).toBe(false);
  });
});
