import { describe, expect, it } from 'vitest';
import { fmtDelta, fmtScore } from './format';

describe('fmtScore', () => {
  it('整数不带小数点', () => {
    expect(fmtScore(98)).toBe('98');
  });
  it('一位小数保留', () => {
    expect(fmtScore(63.5)).toBe('63.5');
  });
  it('浮点误差修正', () => {
    expect(fmtScore(0.1 + 0.2)).toBe('0.3');
  });
  it('null / NaN → —', () => {
    expect(fmtScore(null)).toBe('—');
    expect(fmtScore(NaN)).toBe('—');
  });
});

describe('fmtDelta', () => {
  it('进步带 +', () => {
    expect(fmtDelta(4, true)).toBe('+4');
  });
  it('退步带 -', () => {
    expect(fmtDelta(-4, true)).toBe('-4');
  });
  it('零 → 0', () => {
    expect(fmtDelta(0, true)).toBe('0');
  });
  it('不可比 → —（不许给差值）', () => {
    expect(fmtDelta(4, false)).toBe('—');
    expect(fmtDelta(null, true)).toBe('—');
  });
});
