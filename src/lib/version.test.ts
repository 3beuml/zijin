import { describe, expect, it } from 'vitest';
import { isNewerVersion, parseVersion } from './version.ts';

describe('version · 语义版本比较（更新检查）', () => {
  it('parseVersion：剥掉 v 前缀，按段拆数字', () => {
    expect(parseVersion('v1.0.3')).toEqual([1, 0, 3]);
    expect(parseVersion('1.0.2')).toEqual([1, 0, 2]);
    expect(parseVersion('2.1')).toEqual([2, 1]);
  });

  it('isNewerVersion：主/次/修订号逐段比较', () => {
    expect(isNewerVersion('1.0.2', 'v1.0.3')).toBe(true);
    expect(isNewerVersion('1.0.3', 'v1.0.3')).toBe(false);
    expect(isNewerVersion('1.0.4', 'v1.0.3')).toBe(false);
    expect(isNewerVersion('1.0.2', 'v1.1.0')).toBe(true);
    expect(isNewerVersion('1.0.2', 'v2.0.0')).toBe(true);
    expect(isNewerVersion('1.0.9', 'v1.0.10')).toBe(true); // 数字比较不是字符串比较
  });

  it('段数不齐按 0 补齐；解析失败不乱报', () => {
    expect(isNewerVersion('1.0', 'v1.0.1')).toBe(true);
    expect(isNewerVersion('1.0.0', 'v1.0')).toBe(false);
    expect(isNewerVersion('dev', 'v1.0.0')).toBe(false); // current 解析失败 → 不提示
    expect(isNewerVersion('1.0.2', 'not-a-version')).toBe(false); // latest 解析失败 → 不提示
  });
});
