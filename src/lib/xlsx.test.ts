import { describe, expect, it } from 'vitest';
import { parseCsvTable } from './xlsx.ts';

describe('parseCsvTable（CSV 导入支持）', () => {
  it('逗号分隔：基本解析，空串归 null；中间空行保留为空行（与 xlsx 路径一致）', () => {
    const t = parseCsvTable('姓名,语文,数学\n张三,88,90\n\n李四,,85\n');
    expect(t).toHaveLength(4);
    expect(t[0]).toEqual(['姓名', '语文', '数学']);
    expect(t[1]).toEqual(['张三', '88', '90']);
    expect(t[2]).toEqual([]);
    expect(t[3]).toEqual(['李四', null, '85']);
  });

  it('分号与制表符自动嗅探', () => {
    expect(parseCsvTable('姓名;语文\n张三;88')[0]).toEqual(['姓名', '语文']);
    expect(parseCsvTable('姓名\t语文\n张三\t88')[1]).toEqual(['张三', '88']);
  });

  it('引号内的逗号/换行不拆格；"" 转义为 "', () => {
    const t = parseCsvTable('姓名,备注\n"张三","成绩好,态度佳"\n"李四","说""加油"""');
    expect(t[1]).toEqual(['张三', '成绩好,态度佳']);
    expect(t[2]).toEqual(['李四', '说"加油"']);
  });

  it('CRLF 与末尾空白行', () => {
    const t = parseCsvTable('姓名,语文\r\n张三,88\r\n\r\n\r\n');
    expect(t).toHaveLength(2);
  });

  it('空文本返回空表', () => {
    expect(parseCsvTable('')).toEqual([]);
    expect(parseCsvTable('   \n  ')).toEqual([]);
  });
});
