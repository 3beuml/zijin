/**
 * 成绩分析：考试列表 → 考试详情（班均 / 最高最低 / 总分前三 / 每生与班均差）。
 * 参考 teacher 的 Scores/ExamDetail 子集。入口：「我的 → 成绩分析」。
 * 得分率不做——库里没有满分，宁缺毋滥。
 */
import { useMemo, useState } from 'react';
import type { AppData } from '../../domain/types.ts';
import { examStats, studentTotals } from '../../domain/analytics.ts';
import { fmtScore } from '../../domain/format.ts';
import { myStudents } from '../../domain/students.ts';

export function ExamsScreen({
  data,
  onOpenStudent,
  onBack,
}: {
  data: AppData;
  onOpenStudent: (id: string) => void;
  onBack: () => void;
}) {
  const [openExamId, setOpenExamId] = useState<string | null>(null);
  const mine = useMemo(
    () => myStudents(data.students, data.settings.advisor),
    [data.students, data.settings.advisor],
  );
  const exams = [...data.exams].sort((a, b) => b.order - a.order);

  if (openExamId) {
    return (
      <ExamDetail
        data={data}
        examId={openExamId}
        mine={mine}
        onOpenStudent={onOpenStudent}
        onBack={() => setOpenExamId(null)}
      />
    );
  }

  return (
    <div className="page">
      <button className="back no-print" onClick={onBack}>
        ‹ 返回
      </button>
      <h1 className="page-title">成绩分析</h1>
      {exams.length === 0 ? (
        <div className="empty-hint">还没有考试数据。导入成绩表后会出现在这里。</div>
      ) : (
        <ul className="list">
          {exams.map((e) => {
            const n = new Set(data.scores.filter((s) => s.examId === e.id).map((s) => s.studentId)).size;
            return (
              <li key={e.id}>
                <button className="row" onClick={() => setOpenExamId(e.id)}>
                  <span className="row-main">
                    <span className="row-name">{e.label}</span>
                    <span className="row-sub">
                      {e.date || '未记日期'} · {n} 人有成绩
                    </span>
                  </span>
                  <span className="row-side">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ExamDetail({
  data,
  examId,
  mine,
  onOpenStudent,
  onBack,
}: {
  data: AppData;
  examId: string;
  mine: AppData['students'];
  onOpenStudent: (id: string) => void;
  onBack: () => void;
}) {
  const exam = data.exams.find((e) => e.id === examId);
  const stats = useMemo(
    () => examStats(data.scores, data.exams, data.students, examId),
    [data.scores, data.exams, data.students, examId],
  );
  const { rows, totalAvg } = useMemo(
    () => studentTotals(data.scores, data.exams, data.students, examId),
    [data.scores, data.exams, data.students, examId],
  );
  if (!exam || !stats) return <div className="page">考试不存在</div>;

  const mineRows = rows.filter((r) => mine.some((m) => m.id === r.studentId));
  const showMine = mine.length > 0 && mineRows.length !== rows.length;

  return (
    <div className="page">
      <button className="back no-print" onClick={onBack}>
        ‹ 返回
      </button>
      <h1 className="page-title">{exam.label}</h1>
      <div className="summary-line">
        {exam.date || '未记日期'} · 班均 {fmtScore(totalAvg)}
        {stats.totalMax != null ? ` · 最高 ${fmtScore(stats.totalMax)}` : ''}
      </div>

      <section className="card">
        <h2 className="card-title">各科情况</h2>
        <table className="score-table">
          <thead>
            <tr>
              <th>科目</th>
              <th className="num">人数</th>
              <th className="num">班均</th>
              <th className="num">最高</th>
              <th className="num">最低</th>
            </tr>
          </thead>
          <tbody>
            {stats.subjects.map((s) => (
              <tr key={s.subject}>
                <th>{s.subject}</th>
                <td className="num">{s.count}</td>
                <td className="num">{fmtScore(s.avg)}</td>
                <td className="num">{fmtScore(s.max)}</td>
                <td className="num">{fmtScore(s.min)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {stats.top3.length > 0 && (
        <section className="card">
          <h2 className="card-title">总分前三</h2>
          <ul className="plain-list">
            {stats.top3.map((t, i) => (
              <li key={t.studentId}>
                {['🥇', '🥈', '🥉'][i]} {t.name} · {fmtScore(t.total)}（{t.poolLabel}第 {t.rank ?? '?'} 名）
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">{showMine ? '我的分包 vs 班均' : '每生总分'}</h2>
        <table className="score-table">
          <thead>
            <tr>
              <th>学生</th>
              <th className="num">总分</th>
              <th>名次</th>
              <th className="num">vs 班均</th>
            </tr>
          </thead>
          <tbody>
            {(showMine ? mineRows : rows).map((r) => (
              <tr key={r.studentId}>
                <th>
                  <button className="link-btn" onClick={() => onOpenStudent(r.studentId)}>
                    {r.name}
                  </button>
                </th>
                <td className="num">{fmtScore(r.total)}</td>
                <td className="rank-cell">{r.rank != null ? `${r.poolLabel}第 ${r.rank} 名` : '—'}</td>
                <td className={`num ${r.vsAvg == null ? '' : r.vsAvg >= 0 ? 'up' : 'down'}`}>
                  {r.vsAvg == null ? '—' : r.vsAvg >= 0 ? `+${fmtScore(r.vsAvg)}` : fmtScore(r.vsAvg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
