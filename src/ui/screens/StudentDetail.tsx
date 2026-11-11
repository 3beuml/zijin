/** 学生详情：成绩（名次必带池标签）+ 浮动（同池才可比）+ 记录时间线 + 记一笔 */
import { useState } from 'react';
import type { AppData, Exam } from '../../domain/types.ts';
import { TOTAL_SUBJECT } from '../../domain/types.ts';
import { rankText } from '../../domain/pool.ts';
import { findScore, rankDelta, totalFor } from '../../domain/score.ts';
import { recordsOf } from '../../domain/weekly.ts';
import { fmtDelta, fmtScore } from '../../domain/format.ts';
import { todayStr } from '../util.ts';

const RECORD_TYPES = ['沟通', '谈心', '家访', '约谈', '其他'];

export function StudentDetail({
  data,
  studentId,
  onBack,
  onAddRecord,
}: {
  data: AppData;
  studentId: string;
  onBack: () => void;
  onAddRecord: (studentId: string, rec: { date: string; type: string; content: string }) => Promise<void>;
}) {
  const stu = data.students.find((s) => s.id === studentId);
  if (!stu) return <div className="page">学生不存在</div>;

  const exams = [...data.exams].sort((a, b) => a.order - b.order);
  const timeline = recordsOf(data.records, studentId);

  return (
    <div className="page">
      <button className="back" onClick={onBack}>
        ‹ 返回
      </button>
      <h1 className="page-title">{stu.name}</h1>
      <div className="summary-line">
        {stu.classId ? `${stu.classId} 班 · ` : ''}
        {stu.advisor ? `导师 ${stu.advisor}` : '未分包'}
      </div>

      <section className="card">
        <h2 className="card-title">成绩</h2>
        {exams.length === 0 ? (
          <p className="muted">还没有导入成绩</p>
        ) : (
          exams.map((exam) => (
            <ExamBlock key={exam.id} data={data} exam={exam} studentId={studentId} exams={exams} />
          ))
        )}
      </section>

      <RecordSection records={timeline} onAdd={(rec) => onAddRecord(studentId, rec)} />
    </div>
  );
}

function ExamBlock({
  data,
  exam,
  studentId,
  exams,
}: {
  data: AppData;
  exam: Exam;
  studentId: string;
  exams: Exam[];
}) {
  const prev = exams.find((e) => e.order === exam.order - 1);
  const subjects = [
    ...new Set(
      data.scores
        .filter((s) => s.examId === exam.id && s.studentId === studentId)
        .map((s) => s.subject),
    ),
  ];
  // 科目顺序：四科在前，总分在后
  subjects.sort((a, b) => {
    const ia = a === TOTAL_SUBJECT ? 9 : 0;
    const ib = b === TOTAL_SUBJECT ? 9 : 0;
    return ia - ib;
  });
  return (
    <div className="exam-block">
      <div className="exam-title">
        {exam.label}
        {exam.date ? ` · ${exam.date}` : ''}
      </div>
      <table className="score-table">
        <tbody>
          {subjects.map((subject) => {
            const score = findScore(data.scores, studentId, exam.id, subject);
            const prevScore = prev ? findScore(data.scores, studentId, prev.id, subject) : undefined;
            const delta = rankDelta(prevScore, score);
            const isTotal = subject === TOTAL_SUBJECT;
            return (
              <tr key={subject} className={isTotal ? 'total-row' : ''}>
                <th>{subject}</th>
                <td className="num">{isTotal ? fmtScore(totalFor(data.scores, studentId, exam.id)) : fmtScore(score?.raw)}</td>
                <td className="rank-cell">{score ? rankText(score.pool, score.rank) : '—'}</td>
                <td
                  className={`num delta ${delta.comparable ? (delta.delta ?? 0) > 0 ? 'up' : (delta.delta ?? 0) < 0 ? 'down' : '' : 'incomparable'}`}
                  title={delta.comparable ? '与上次名次相比，正为进步' : delta.reason}
                >
                  {delta.comparable ? fmtDelta(delta.delta, true) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecordSection({
  records,
  onAdd,
}: {
  records: AppData['records'];
  onAdd: (rec: { date: string; type: string; content: string }) => Promise<void>;
}) {
  const [type, setType] = useState(RECORD_TYPES[0]);
  const [date, setDate] = useState(todayStr());
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!content.trim() || saving) return;
    setSaving(true);
    await onAdd({ date, type, content: content.trim() });
    setContent('');
    setSaving(false);
  };

  return (
    <section className="card">
      <h2 className="card-title">记录（{records.length}）</h2>
      <div className="record-form">
        <div className="record-form-row">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="记录类型">
            {RECORD_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="日期" />
        </div>
        <textarea
          placeholder="记一笔……（发生了什么、约定了什么）"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
        />
        <button className="btn primary" disabled={!content.trim() || saving} onClick={submit}>
          保存
        </button>
      </div>
      {records.length === 0 ? (
        <p className="muted">还没有记录</p>
      ) : (
        <ul className="timeline">
          {records.map((r) => (
            <li key={r.id}>
              <span className="tl-date">{r.date}</span>
              <span className="tag">{r.type}</span>
              <span className="tl-content">{r.content}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
