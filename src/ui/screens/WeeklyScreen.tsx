/** 周手册：本周覆盖概览 + 未覆盖名单（打印样式在阶段 4 加） */
import { useMemo, useState } from 'react';
import type { AppData } from '../../domain/types.ts';
import { weeklySummary } from '../../domain/weekly.ts';
import { shortDate, shiftDate, todayStr } from '../util.ts';

export function WeeklyScreen({
  data,
  onOpenStudent,
}: {
  data: AppData;
  onOpenStudent: (id: string) => void;
}) {
  const [refDate, setRefDate] = useState(todayStr());
  const week = useMemo(() => weeklySummary(data.students, data.records, refDate), [data, refDate]);

  const weekRecords = data.records.filter((r) => r.date >= week.start && r.date <= week.end);

  return (
    <div className="page">
      <h1 className="page-title">周手册</h1>
      <div className="week-nav">
        <button className="btn ghost" onClick={() => setRefDate(shiftDate(refDate, -7))}>
          ‹ 上周
        </button>
        <span className="week-range">
          {shortDate(week.start)} – {shortDate(week.end)}
        </span>
        <button className="btn ghost" onClick={() => setRefDate(shiftDate(refDate, 7))}>
          下周 ›
        </button>
      </div>

      <section className="card highlight">
        <div className="coverage">
          <span className="coverage-num num">
            {week.covered}/{week.total}
          </span>
          <span className="coverage-label">本周已沟通学生</span>
        </div>
        <div className="muted">本周共 {weekRecords.length} 条记录</div>
      </section>

      {data.students.length === 0 ? (
        <div className="empty-hint">还没有学生数据。到「我的」导入成绩表。</div>
      ) : (
        <>
          <h2 className="section-title">本周未覆盖（{week.uncovered.length}）</h2>
          {week.uncovered.length === 0 ? (
            <p className="muted">全部覆盖 🎉</p>
          ) : (
            <ul className="list">
              {week.uncovered.map((s) => (
                <li key={s.id}>
                  <button className="row compact" onClick={() => onOpenStudent(s.id)}>
                    <span className="row-main">
                      <span className="row-name">{s.name}</span>
                      <span className="row-sub">{s.advisor ? `导师 ${s.advisor}` : '未分包'}</span>
                    </span>
                    <span className="row-side warn">待联系</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h2 className="section-title">本周记录</h2>
          {weekRecords.length === 0 ? (
            <p className="muted">本周还没有记录</p>
          ) : (
            <ul className="timeline">
              {[...weekRecords]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((r) => {
                  const stu = data.students.find((s) => s.id === r.studentId);
                  return (
                    <li key={r.id}>
                      <span className="tl-date">{shortDate(r.date)}</span>
                      <span className="tag">{r.type}</span>
                      <span className="tl-content">
                        <b>{stu?.name ?? '?'}</b> · {r.content}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
