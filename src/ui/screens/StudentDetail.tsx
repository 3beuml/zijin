/** 学生详情：成绩（名次必带池标签 + 总分趋势）+ 考勤/作业卡（v0.6）+ 浮动 + 记录时间线 */
import { useState } from 'react';
import type { AppData, Exam, RecordItem, Todo } from '../../domain/types.ts';
import { TOTAL_SUBJECT } from '../../domain/types.ts';
import { rankText } from '../../domain/pool.ts';
import { findScore, rankDelta, totalFor } from '../../domain/score.ts';
import { recordsOf } from '../../domain/weekly.ts';
import { openTodosOf, toggleTodo } from '../../domain/todo.ts';
import { attendanceOf, countByType } from '../../domain/attendance.ts';
import { homeworkStats } from '../../domain/homework.ts';
import { fmtDelta, fmtScore } from '../../domain/format.ts';
import { nowIso, todayStr } from '../util.ts';
import { RecordEditSheet } from '../components/RecordEditSheet.tsx';
import { ProfileCard } from '../components/ProfileCard.tsx';
import { AttendanceSheet } from '../components/AttendanceSheet.tsx';
import { IconClock } from '../icons.tsx';

const RECORD_TYPES = ['沟通', '谈心', '家访', '约谈', '其他'];

export function StudentDetail({
  data,
  studentId,
  onBack,
  onAddRecord,
  onUpdate,
}: {
  data: AppData;
  studentId: string;
  onBack: () => void;
  onAddRecord: (
    studentId: string,
    rec: { date: string; type: string; content: string },
    followUp?: { title: string; due: string },
  ) => Promise<void>;
  onUpdate: (next: AppData) => Promise<void>;
}) {
  const stu = data.students.find((s) => s.id === studentId);
  if (!stu) return <div className="page">学生不存在</div>;

  const exams = [...data.exams].sort((a, b) => a.order - b.order);
  const timeline = recordsOf(data.records, studentId);
  const followUps = openTodosOf(data.todos, studentId);
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null);
  const [attOpen, setAttOpen] = useState(false);

  const attendance = attendanceOf(data.attendance, studentId);
  const attCounts = [...countByType(data.attendance, studentId).entries()];
  const hwStats = homeworkStats(data.homework, studentId);
  // 总分趋势：≥3 次有总分的考试才画（一次考试是数字，三次考试才是故事）
  const trend = exams
    .map((e) => ({ label: e.label, total: totalFor(data.scores, studentId, e.id) }))
    .filter((t): t is { label: string; total: number } => t.total != null);

  const toggleFollowUp = async (t: Todo) => {
    const todos = data.todos.map((x) => (x.id === t.id ? toggleTodo(x, nowIso()) : x));
    await onUpdate({ ...data, todos });
  };

  const saveRecord = async (next: RecordItem) => {
    await onUpdate({ ...data, records: data.records.map((r) => (r.id === next.id ? next : r)) });
    setEditingRecord(null);
  };
  const deleteRecord = async (rec: RecordItem) => {
    await onUpdate({ ...data, records: data.records.filter((r) => r.id !== rec.id) });
    setEditingRecord(null);
  };
  const deleteAttendance = async (id: string) => {
    if (!confirm('删除这条考勤记录？')) return;
    await onUpdate({ ...data, attendance: data.attendance.filter((a) => a.id !== id) });
  };

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

      <ProfileCard data={data} student={stu} onUpdate={onUpdate} />

      <section className="card">
        <h2 className="card-title">成绩</h2>
        {exams.length === 0 ? (
          <p className="muted">还没有导入成绩</p>
        ) : (
          <>
            {trend.length >= 3 && <TrendChart points={trend} />}
            {exams.map((exam) => (
              <ExamBlock key={exam.id} data={data} exam={exam} studentId={studentId} exams={exams} />
            ))}
          </>
        )}
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">考勤</h2>
          <button className="link-btn" onClick={() => setAttOpen(true)}>
            <span className="row-with-icon"><IconClock size={14} /> 记考勤</span>
          </button>
        </div>
        {attendance.length === 0 ? (
          <p className="muted">本学期还没有考勤记录。</p>
        ) : (
          <>
            {attCounts.length > 0 && (
              <p className="att-summary">
                {attCounts.map(([t, n]) => (n > 1 ? `${t} ${n} 次` : t)).join(' · ')}
              </p>
            )}
            <ul className="timeline">
              {attendance.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <span className="tl-date">{a.date}</span>
                  <span className={`tag att-tag att-${a.type === '迟到' || a.type === '早退' || a.type === '旷课' || a.type === '离校' ? 'bad' : 'leave'}`}>{a.type}</span>
                  <span className="tl-content">
                    {a.slot ? `${a.slot} · ` : ''}
                    {a.reason ?? ''}
                  </span>
                  <button className="link-btn danger" onClick={() => void deleteAttendance(a.id)}>
                    删
                  </button>
                </li>
              ))}
            </ul>
            {attendance.length > 5 && <p className="muted">只显示最近 5 条。</p>}
          </>
        )}
      </section>

      {data.homework.length > 0 && (
        <section className="card">
          <div className="card-title-row">
            <h2 className="card-title">作业</h2>
            <span className="tag">登记 {data.homework.length} 次</span>
          </div>
          <p className="att-summary">
            没交 {hwStats.missed} 次 · 迟交 {hwStats.late} 次
            {hwStats.streak >= 3 ? (
              <span className="hw-streak-warn"> ⚠️ 已连续 {hwStats.streak} 次没交</span>
            ) : null}
          </p>
          {hwStats.latestMissed.length > 0 && (
            <ul className="timeline">
              {hwStats.latestMissed.map((m, i) => (
                <li key={i}>
                  <span className="tl-date">{m.date}</span>
                  <span className="tag">{m.status}</span>
                  <span className="tl-content">{m.subject ?? ''}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {followUps.length > 0 && (
        <section className="card">
          <h2 className="card-title">跟进（{followUps.length}）</h2>
          <ul className="list">
            {followUps.map((t) => (
              <li key={t.id}>
                <div className="row compact todo-row">
                  <button className="todo-check" aria-label="标记完成" onClick={() => void toggleFollowUp(t)}>
                    {t.status === 'done' ? '✓' : ''}
                  </button>
                  <span className="row-main">
                    <span className="row-name">{t.title}</span>
                    <span className="row-sub">{t.due === todayStr() ? '今天到期' : t.due}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RecordSection
        records={timeline}
        onAdd={(rec, followUp) => onAddRecord(studentId, rec, followUp)}
        onEditRecord={setEditingRecord}
      />

      {editingRecord && (
        <RecordEditSheet
          record={editingRecord}
          onCancel={() => setEditingRecord(null)}
          onSave={saveRecord}
          onDelete={deleteRecord}
        />
      )}

      {attOpen && (
        <AttendanceSheet
          data={data}
          fixedStudentId={studentId}
          onClose={() => setAttOpen(false)}
          onSave={async (att) => {
            await onUpdate({ ...data, attendance: [...data.attendance, att] });
          }}
        />
      )}
    </div>
  );
}

/** 总分趋势迷你折线（纯 SVG 现算，不引图表库）；3+ 次考试才显示 */
function TrendChart({ points }: { points: { label: string; total: number }[] }) {
  const w = 320;
  const h = 72;
  const pad = 8;
  const vals = points.map((p) => p.total);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number): number => pad + (i * (w - pad * 2)) / (points.length - 1);
  const y = (v: number): number => pad + (1 - (v - min) / span) * (h - pad * 2);
  const line = points.map((p, i) => `${x(i)},${y(p.total)}`).join(' ');
  return (
    <div className="trend-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="trend-svg" aria-label="总分趋势">
        <polyline points={line} fill="none" stroke="var(--indigo-500)" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.total)} r="3" fill="var(--indigo-700)" />
        ))}
        <text x={x(0)} y={y(points[0].total) - 5} className="trend-num" textAnchor="start">{points[0].total}</text>
        <text x={x(points.length - 1)} y={y(points[points.length - 1].total) - 5} className="trend-num" textAnchor="end">
          {points[points.length - 1].total}
        </text>
      </svg>
      <div className="trend-labels">
        {points.map((p, i) => (
          <span key={i}>{p.label}</span>
        ))}
      </div>
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
  // 这次考试是否「只有名次」（导入的表里没有分数列，只留了名次用来算浮动）
  const rankOnly =
    subjects.length > 0 &&
    data.scores
      .filter((s) => s.examId === exam.id && s.studentId === studentId && s.subject !== TOTAL_SUBJECT)
      .every((s) => s.raw == null);
  return (
    <div className="exam-block">
      <div className="exam-title">
        {exam.label}
        {exam.date ? ` · ${exam.date}` : ''}
      </div>
      {rankOnly && (
        <p className="muted rank-only-note">这次考试只记了名次（当时导入的表里没有分数列），分数显示「—」是正常的。</p>
      )}
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
  onEditRecord,
}: {
  records: AppData['records'];
  onAdd: (
    rec: { date: string; type: string; content: string },
    followUp?: { title: string; due: string },
  ) => Promise<void>;
  onEditRecord: (rec: RecordItem) => void;
}) {
  const [type, setType] = useState(RECORD_TYPES[0]);
  const [date, setDate] = useState(todayStr());
  const [content, setContent] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [followUpDue, setFollowUpDue] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!content.trim() || saving) return;
    setSaving(true);
    const hasFollowUp = followUp.trim() !== '';
    await onAdd(
      { date, type, content: content.trim() },
      hasFollowUp ? { title: followUp, due: followUpDue || todayStr() } : undefined,
    );
    setContent('');
    setFollowUp('');
    setFollowUpDue('');
    setSaving(false);
  };

  return (
    <section className="card">
      <h2 className="card-title">记录（{records.length}）</h2>
      {records.length > 0 && (
        <div className="recent-records">
          <div className="recent-records-title">最近 {Math.min(2, records.length)} 条（写的时候参考，避免记重）</div>
          <ul>
            {records.slice(0, 2).map((r) => (
              <li key={r.id}>
                <span className="tl-date">{r.date}</span>
                <span className="tag">{r.type}</span>
                <span className="recent-content">{r.content}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
          className="autosize"
          placeholder="记一笔……（发生了什么、约定了什么）"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
        />
        <input
          className="followup-input"
          placeholder="跟进（可选）：如 下周三前再回访一次"
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
        />
        {followUp.trim() !== '' && (
          <input type="date" value={followUpDue} onChange={(e) => setFollowUpDue(e.target.value)} aria-label="跟进截止" />
        )}
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
              <button className="link-btn" onClick={() => onEditRecord(r)}>
                改
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
