/**
 * 成绩分析：考试列表 → 考试详情（班均 / 最高最低 / 总分前三 / 每生与班均差）。
 * 参考 teacher 的 Scores/ExamDetail 子集。入口：「我的 → 成绩分析」。
 * 得分率不做——库里没有满分，宁缺毋滥。
 * v0.5：考试可改名/补日期（导入时默认叫「本次」，三个月后就不知道是哪次了）；
 * 总分前三的 emoji 奖牌换成单色数字徽标（design-ui：语义色降饱和、不做装饰）。
 */
import { useMemo, useState } from 'react';
import type { AppData, Exam } from '../../domain/types.ts';
import { examStats, studentTotals } from '../../domain/analytics.ts';
import { fmtScore } from '../../domain/format.ts';
import { myStudents } from '../../domain/students.ts';
import { IconClose } from '../icons.tsx';

export function ExamsScreen({
  data,
  onOpenStudent,
  onBack,
  onUpdate,
}: {
  data: AppData;
  onOpenStudent: (id: string) => void;
  onBack: () => void;
  onUpdate: (next: AppData) => Promise<void>;
}) {
  const [openExamId, setOpenExamId] = useState<string | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const mine = useMemo(
    () => myStudents(data.students, data.settings.advisor),
    [data.students, data.settings.advisor],
  );
  const exams = [...data.exams].sort((a, b) => b.order - a.order);

  // 编辑弹层挂在最外层：列表页和详情页都能打开（改名入口在详情页标题旁）
  const body = openExamId ? (
    <ExamDetail
      data={data}
      examId={openExamId}
      mine={mine}
      onOpenStudent={onOpenStudent}
      onBack={() => setOpenExamId(null)}
      onEditExam={setEditingExam}
    />
  ) : (
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

  return (
    <>
      {body}
      {editingExam && (
        <ExamMetaSheet
          data={data}
          exam={editingExam}
          onUpdate={onUpdate}
          onClose={() => setEditingExam(null)}
        />
      )}
    </>
  );
}

/** 考试信息编辑弹层：改名 + 补日期 */
function ExamMetaSheet({
  data,
  exam,
  onUpdate,
  onClose,
}: {
  data: AppData;
  exam: Exam;
  onUpdate: (next: AppData) => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(exam.label);
  const [date, setDate] = useState(exam.date);
  const clash = label.trim() !== '' && data.exams.some((e) => e.id !== exam.id && e.label === label.trim());

  const save = async () => {
    if (!label.trim() || clash) return;
    await onUpdate({
      ...data,
      exams: data.exams.map((e) => (e.id === exam.id ? { ...e, label: label.trim(), date } : e)),
    });
    onClose();
  };

  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="card-title">改考试信息</h2>
          <button className="icon-btn" aria-label="关闭" onClick={onClose}>
            <IconClose size={18} />
          </button>
        </div>
        <div className="form-col">
          <label className="field-label">
            考试名称
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="如：期中 / 十月月考" />
          </label>
          {clash && <p className="muted danger-text">已经有叫这个名字的考试了，换一个。</p>}
          <label className="field-label">
            考试日期（可选）
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" disabled={!label.trim() || clash} onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

const MEDAL_CLASS = ['medal medal-1', 'medal medal-2', 'medal medal-3'];

function ExamDetail({
  data,
  examId,
  mine,
  onOpenStudent,
  onBack,
  onEditExam,
}: {
  data: AppData;
  examId: string;
  mine: AppData['students'];
  onOpenStudent: (id: string) => void;
  onBack: () => void;
  onEditExam: (exam: Exam) => void;
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
      <div className="page-title-row">
        <h1 className="page-title">{exam.label}</h1>
        <button className="link-btn no-print" onClick={() => onEditExam(exam)}>
          改名 / 补日期
        </button>
      </div>
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
              <li key={t.studentId} className="top3-row">
                <span className={MEDAL_CLASS[i] ?? 'medal'}>{i + 1}</span>
                {t.name} · {fmtScore(t.total)}（{t.poolLabel}第 {t.rank ?? '?'} 名）
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
