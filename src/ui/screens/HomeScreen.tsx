/**
 * 今日：早上 30 秒知道「今天几件事、谁还没聊」。
 * 参考 teacher 的今日页：待办（逾期置顶）+ 分包覆盖卡 + 快捷记录 + 近期重要工作。
 * 铁律：今日页不显示成绩排名，避免在教室被学生看到（teacher 需求 §5.1）。
 */
import { useMemo, useState } from 'react';
import type { AppData, Todo } from '../../domain/types.ts';
import { todoViews, toggleTodo, todosDueBetween } from '../../domain/todo.ts';
import { myStudents } from '../../domain/students.ts';
import { weeklySummary } from '../../domain/weekly.ts';
import { newId, nowIso, shortDate, shiftDate, todayStr } from '../util.ts';

const QUICK_TYPES = ['沟通', '谈心', '家访', '其他'];

export function HomeScreen({
  data,
  onUpdate,
  onOpenStudent,
  onGoStudents,
  onGoTodos,
  onGoWeekly,
}: {
  data: AppData;
  onUpdate: (next: AppData) => Promise<void>;
  onOpenStudent: (id: string) => void;
  onGoStudents: () => void;
  onGoTodos: () => void;
  onGoWeekly: () => void;
}) {
  const today = todayStr();
  const [quickType, setQuickType] = useState<string | null>(null);
  const views = useMemo(() => todoViews(data.todos, today), [data.todos, today]);
  const soon = useMemo(
    () => todosDueBetween(data.todos, shiftDate(today, 1), shiftDate(today, 7)),
    [data.todos, today],
  );

  const mine = useMemo(
    () => myStudents(data.students, data.settings.advisor),
    [data.students, data.settings.advisor],
  );
  const scopeStudents = mine.length > 0 ? mine : data.students;
  const week = useMemo(
    () => weeklySummary(scopeStudents, data.records, today),
    [scopeStudents, data.records, today],
  );
  const uncovered = week.uncovered;

  const dateLabel = useMemo(() => {
    const [, m, d] = today.split('-');
    const wd = ['日', '一', '二', '三', '四', '五', '六'][new Date(`${today}T12:00:00Z`).getUTCDay()];
    return `${Number(m)}月${Number(d)}日 周${wd}`;
  }, [today]);

  const toggle = async (t: Todo) => {
    const todos = data.todos.map((x) => (x.id === t.id ? toggleTodo(x, nowIso()) : x));
    await onUpdate({ ...data, todos });
  };

  return (
    <div className="page">
      <h1 className="page-title">今日</h1>
      <div className="summary-line">{dateLabel}</div>

      {/* 周手册入口（design-ui：周手册放今日页顶部入口） */}
      <section className="card weekly-entry" onClick={onGoWeekly} role="button" aria-label="打开周手册">
        <span className="row-main">
          <span className="row-name">周手册 · {shortDate(week.start)} – {shortDate(week.end)}</span>
          <span className="row-sub">已沟通 {week.covered}/{scopeStudents.length} · 点开登记表与导出</span>
        </span>
        <span className="row-side">›</span>
      </section>

      {(views.overdue.length > 0 || views.today.length > 0) && (
        <section className="card">
          <h2 className="card-title">
            今日待办
            {views.overdue.length > 0 && <span className="overdue-badge">{views.overdue.length} 项逾期</span>}
          </h2>
          <ul className="list">
            {[...views.overdue, ...views.today].map((t) => (
              <li key={t.id}>
                <div className={`row compact todo-row${t.due < today ? ' overdue' : ''}`}>
                  <button className="todo-check" aria-label="标记完成" onClick={() => void toggle(t)}>
                    {t.status === 'done' ? '✓' : ''}
                  </button>
                  <span className="row-main">
                    <span className="row-name">{t.title}</span>
                    <span className="row-sub">
                      {t.due === today ? '今天' : t.due}
                      {t.studentId ? ` · ${data.students.find((s) => s.id === t.studentId)?.name ?? ''}` : ''}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <button className="link-btn" onClick={onGoTodos}>
            全部待办 ›
          </button>
        </section>
      )}

      <section
        className="card highlight"
        onClick={onGoStudents}
        role="button"
        aria-label="查看本周覆盖"
      >
        <div className="coverage">
          <span className="coverage-num num">
            {week.covered}/{scopeStudents.length}
          </span>
          <span className="coverage-label">本周已沟通{mine.length > 0 ? '（分包）' : ''}</span>
        </div>
        {uncovered.length > 0 ? (
          <div className="muted">
            还差 {uncovered.length} 人：{uncovered.slice(0, 6).map((s) => s.name).join('、')}
            {uncovered.length > 6 ? ' …' : ''}
          </div>
        ) : (
          <div className="muted ok-text">本周全覆盖 ✓</div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">记一笔</h2>
        <div className="quick-grid">
          {QUICK_TYPES.map((t) => (
            <button key={t} className="quick-btn" onClick={() => setQuickType(t)}>
              {t}
            </button>
          ))}
        </div>
      </section>

      {soon.length > 0 && (
        <section className="card">
          <h2 className="card-title">近期重要工作（7 天内 {soon.length} 件）</h2>
          <ul className="plain-list">
            {soon.slice(0, 5).map((t) => (
              <li key={t.id}>
                {t.due} · {t.title}
                {t.studentId ? `（${data.students.find((s) => s.id === t.studentId)?.name ?? ''}）` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {quickType && (
        <QuickRecordSheet
          data={data}
          defaultStudents={scopeStudents}
          type={quickType}
          onClose={() => setQuickType(null)}
          onSave={async (studentId, rec) => {
            const id = newId('r');
            await onUpdate({
              ...data,
              records: [...data.records, { ...rec, id, studentId, createdAt: nowIso() }],
            });
            setQuickType(null);
          }}
          onOpenStudent={(id) => {
            setQuickType(null);
            onOpenStudent(id);
          }}
        />
      )}
    </div>
  );
}

function QuickRecordSheet({
  data,
  defaultStudents,
  type,
  onClose,
  onSave,
  onOpenStudent,
}: {
  data: AppData;
  defaultStudents: AppData['students'];
  type: string;
  onClose: () => void;
  onSave: (studentId: string, rec: { date: string; type: string; content: string }) => Promise<void>;
  onOpenStudent: (id: string) => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [content, setContent] = useState('');
  const [kw, setKw] = useState('');
  const candidates = (defaultStudents.length ? defaultStudents : data.students).filter(
    (s) => !kw.trim() || s.name.includes(kw.trim()),
  );

  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="card-title">快速{type}</h2>
        {!studentId ? (
          <>
            <input
              className="search"
              type="search"
              placeholder="搜学生姓名"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
            />
            <ul className="list student-pick-list">
              {candidates.map((s) => (
                <li key={s.id}>
                  <button className="row compact" onClick={() => setStudentId(s.id)}>
                    <span className="row-main">
                      <span className="row-name">{s.name}</span>
                      <span className="row-sub">{s.advisor ? `导师 ${s.advisor}` : '未分包'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="summary-line">
              {data.students.find((s) => s.id === studentId)?.name}
              <button className="link-btn" onClick={() => setStudentId('')}>
                换人
              </button>
            </div>
            <textarea
              placeholder={`${type}内容（发生了什么、约定了什么）`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
            <div className="btn-row">
              <button className="btn" onClick={() => onOpenStudent(studentId)}>
                去详情
              </button>
              <button
                className="btn primary"
                disabled={!content.trim()}
                onClick={() => void onSave(studentId, { date: todayStr(), type, content: content.trim() })}
              >
                保存
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
