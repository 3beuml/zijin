/** 学生列表：一屏 8–10 人，行 56px，右侧只有「本周状态」一个信息 */
import { useMemo, useState } from 'react';
import type { AppData } from '../../domain/types.ts';
import { weeklySummary } from '../../domain/weekly.ts';

export function StudentsScreen({
  data,
  onOpenStudent,
}: {
  data: AppData;
  onOpenStudent: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const today = todayStr();

  const week = useMemo(() => weeklySummary(data.students, data.records, today), [data, today]);

  const students = useMemo(() => {
    const kw = q.trim();
    if (!kw) return data.students;
    return data.students.filter((s) => s.name.includes(kw) || s.advisor.includes(kw));
  }, [data.students, q]);

  return (
    <div className="page">
      <h1 className="page-title">学生</h1>
      <div className="summary-line">
        {data.students.length} 人 · 本周已沟通 {week.covered}/{week.total}
      </div>
      <input
        className="search"
        type="search"
        placeholder="搜姓名 / 导师"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {data.students.length === 0 ? (
        <div className="empty-hint">
          还没有学生数据。
          <br />
          到「我的」导入一份成绩表开始。
        </div>
      ) : (
        <ul className="list">
          {students.map((s) => {
            const count = week.countByStudent.get(s.id) ?? 0;
            return (
              <li key={s.id}>
                <button className="row" onClick={() => onOpenStudent(s.id)}>
                  <span className="row-main">
                    <span className="row-name">{s.name}</span>
                    <span className="row-sub">{s.advisor ? `导师 ${s.advisor}` : '未分包'}</span>
                  </span>
                  <span className={`row-side ${count > 0 ? 'ok' : 'warn'}`}>
                    {count > 0 ? `本周 ${count} 次` : '本周未联系'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
