/**
 * 周手册：16 人登记表（每人一行：沟通/谈心/家访/其他 + 最近成绩 + 摘要）
 * + 未覆盖提醒 + 下周重点（自动带出待办）+ Excel 导出 + A4 导出/打印。
 * 参考 teacher 的周工作手册——学校要交的格式。
 */
import { useMemo, useState } from 'react';
import type { AppData } from '../../domain/types.ts';
import { weeklyRegister, weeklySummary } from '../../domain/weekly.ts';
import { myStudents } from '../../domain/students.ts';
import { nextWeekTodos } from '../../domain/todo.ts';
import { fmtScore } from '../../domain/format.ts';
import { shortDate, shiftDate, todayStr } from '../util.ts';
import { buildWeeklyHtml, shareOrDownloadHtml } from '../print.ts';
import { exportRegisterExcel } from '../excel.ts';

const TYPE_COLS = ['沟通', '谈心', '家访'];

export function WeeklyScreen({
  data,
  onOpenStudent,
  onBack,
}: {
  data: AppData;
  onOpenStudent: (id: string) => void;
  onBack?: () => void;
}) {
  const [refDate, setRefDate] = useState(todayStr());
  const mine = useMemo(
    () => myStudents(data.students, data.settings.advisor),
    [data.students, data.settings.advisor],
  );
  const scopeStudents = mine.length > 0 ? mine : data.students;
  const reg = useMemo(
    () => weeklyRegister(scopeStudents, data.records, data.scores, data.exams, refDate),
    [scopeStudents, data.records, data.scores, data.exams, refDate],
  );
  const week = useMemo(
    () => weeklySummary(scopeStudents, data.records, refDate),
    [scopeStudents, data.records, refDate],
  );
  const nextWeek = useMemo(() => nextWeekTodos(data.todos, reg.end), [data.todos, reg.end]);

  const missing = reg.rows.filter((r) => r.count === 0);
  const advisorLabel = mine.length > 0 ? `分包 ${mine.length} 人` : `全班 ${data.students.length} 人`;

  const exportExcel = async () => {
    await exportRegisterExcel(reg.rows, {
      range: `${shortDate(reg.start)} – ${shortDate(reg.end)}`,
      title: `子衿周手册（${advisorLabel}）`,
      fileName: `子衿周手册-${reg.start}.xlsx`,
      nextWeek: nextWeek.map((t) => ({
        due: t.due,
        title: t.title,
        student: t.studentId ? data.students.find((s) => s.id === t.studentId)?.name : undefined,
      })),
    });
  };

  const exportHtml = async () => {
    const html = buildWeeklyHtml(data, refDate);
    await shareOrDownloadHtml(html, `子衿周手册-${reg.start}.html`);
  };

  return (
    <div className="page">
      {onBack && (
        <button className="back no-print" onClick={onBack}>
          ‹ 返回
        </button>
      )}
      <div className="print-only print-head">
        周手册（{shortDate(reg.start)} – {shortDate(reg.end)}）· {advisorLabel} · 已沟通 {week.covered}
      </div>
      <h1 className="page-title">周手册</h1>
      <div className="week-nav">
        <button className="btn ghost" onClick={() => setRefDate(shiftDate(refDate, -7))}>
          ‹ 上周
        </button>
        <span className="week-range">
          {shortDate(reg.start)} – {shortDate(reg.end)}
        </span>
        <button className="btn ghost" onClick={() => setRefDate(shiftDate(refDate, 7))}>
          下周 ›
        </button>
      </div>
      <div className="summary-line">
        {advisorLabel} · 已沟通 {week.covered}/{scopeStudents.length} · 本周记录{' '}
        {reg.rows.reduce((n, r) => n + r.count, 0)} 条
      </div>
      <div className="week-actions no-print">
        <button className="btn" onClick={() => window.print()}>
          打印
        </button>
        <button className="btn" onClick={exportHtml}>
          A4 页面
        </button>
        <button className="btn primary" onClick={exportExcel}>
          导出 Excel
        </button>
      </div>

      {missing.length > 0 && (
        <div className="weekly-missing no-print">
          本周还没记录：{missing.map((r) => r.student.name).join('、')}
        </div>
      )}

      <div className="register-wrap">
        <table className="register-table">
          <thead>
            <tr>
              <th>学生</th>
              {TYPE_COLS.map((t) => (
                <th key={t} className="c">
                  {t}
                </th>
              ))}
              <th className="c">其他</th>
              <th>最近成绩</th>
              <th>本周摘要</th>
            </tr>
          </thead>
          <tbody>
            {reg.rows.map((r) => (
              <tr key={r.student.id} className={r.count === 0 ? 'empty-row' : ''}>
                <td>
                  <button className="link-btn" onClick={() => onOpenStudent(r.student.id)}>
                    {r.student.name}
                  </button>
                </td>
                {TYPE_COLS.map((t) => (
                  <td key={t} className={`num c${r.countByType.get(t) ? ' has' : ''}`}>
                    {r.countByType.get(t) || '—'}
                  </td>
                ))}
                <td className="num c">
                  {[...r.countByType.entries()]
                    .filter(([t]) => !TYPE_COLS.includes(t))
                    .reduce((n, [, c]) => n + c, 0) || '—'}
                </td>
                <td className="num">
                  {r.total == null
                    ? '—'
                    : `${fmtScore(r.total)}${r.rank != null ? `（${r.poolLabel}第 ${r.rank} 名）` : ''}`}
                </td>
                <td className="summary-cell">{r.summary || '本周无记录'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">下周重点</h2>
          <span className="tag">{nextWeek.length} 件</span>
        </div>
        {nextWeek.length === 0 ? (
          <p className="muted">下周还没有安排，可以到「待办」里加。</p>
        ) : (
          <ul className="plain-list">
            {nextWeek.slice(0, 6).map((t) => (
              <li key={t.id}>
                {t.due} · {t.title}
                {t.studentId ? `（${data.students.find((s) => s.id === t.studentId)?.name ?? ''}）` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
