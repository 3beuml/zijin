/** 待办：今日 / 本周 / 全部 / 已完成；逾期红色置顶；完成可撤销 */
import { useMemo, useState } from 'react';
import type { AppData, Todo } from '../../domain/types.ts';
import { todoViews, toggleTodo, todosDueBetween } from '../../domain/todo.ts';
import { TodoForm } from '../components/TodoForm.tsx';
import { nowIso, shiftDate, todayStr } from '../util.ts';

const PRIO_LABEL: Record<Todo['priority'], string> = { high: '高', mid: '中', low: '低' };

type ViewKey = 'today' | 'week' | 'all' | 'done';

export function TodosScreen({
  data,
  onUpdate,
}: {
  data: AppData;
  onUpdate: (next: AppData) => Promise<void>;
}) {
  const today = todayStr();
  const [view, setView] = useState<ViewKey>('today');
  const [editing, setEditing] = useState<Todo | 'new' | null>(null);
  const views = useMemo(() => todoViews(data.todos, today), [data.todos, today]);
  const weekEnd = endOfWeek(today);
  const week = useMemo(
    () =>
      [
        ...views.overdue,
        ...views.today,
        ...todosDueBetween(data.todos, today, weekEnd).filter(
          (t) => t.due !== today && !views.overdue.includes(t),
        ),
      ].filter((t) => t.status === 'open'),
    [views, data.todos, today, weekEnd],
  );

  const toggle = async (t: Todo) => {
    const todos = data.todos.map((x) => (x.id === t.id ? toggleTodo(x, nowIso()) : x));
    await onUpdate({ ...data, todos });
  };

  const remove = async (t: Todo) => {
    if (!confirm(`删除待办「${t.title}」？`)) return;
    await onUpdate({ ...data, todos: data.todos.filter((x) => x.id !== t.id) });
  };

  const shown: Todo[] =
    view === 'today'
      ? [...views.overdue, ...views.today]
      : view === 'week'
        ? week
        : view === 'all'
          ? [...views.overdue, ...views.today, ...views.later, ...views.done]
          : views.done;

  return (
    <div className="page">
      <h1 className="page-title">待办</h1>
      <div className="view-tabs">
        {(
          [
            ['today', `今日 ${views.today.length + views.overdue.length}`],
            ['week', `本周 ${week.length}`],
            ['all', '全部'],
            ['done', `已完成 ${views.done.length}`],
          ] as [ViewKey, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={`view-tab${view === key ? ' active' : ''}`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="muted">这里空空的。</p>
      ) : (
        <ul className="list">
          {shown.map((t) => {
            const overdue = t.status === 'open' && t.due < today;
            return (
              <li key={t.id}>
                <div className={`row todo-row${overdue ? ' overdue' : ''}${t.status === 'done' ? ' done' : ''}`}>
                  <button
                    className="todo-check"
                    aria-label={t.status === 'done' ? '撤销完成' : '标记完成'}
                    onClick={() => void toggle(t)}
                  >
                    {t.status === 'done' ? '✓' : ''}
                  </button>
                  <span className="row-main">
                    <span className="row-name">{t.title}</span>
                    <span className="row-sub">
                      {t.due === today ? '今天' : t.due} · {t.type}
                      {t.priority === 'high' ? ' · 高优先级' : ''}
                      {t.studentId
                        ? ` · ${data.students.find((s) => s.id === t.studentId)?.name ?? ''}`
                        : ''}
                    </span>
                  </span>
                  <span className="row-side">
                    {overdue && (
                      <button
                        className="link-btn"
                        onClick={() => {
                          const tomorrow = shiftDate(today, 1);
                          void onUpdate({
                            ...data,
                            todos: data.todos.map((x) => (x.id === t.id ? { ...x, due: tomorrow } : x)),
                          });
                        }}
                      >
                        顺延
                      </button>
                    )}
                    <button className="link-btn" onClick={() => setEditing(t)}>
                      编辑
                    </button>
                    <button className="link-btn danger" onClick={() => void remove(t)}>
                      删
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button className="btn primary big" onClick={() => setEditing('new')}>
        新建待办
      </button>

      {editing && (
        <TodoForm
          data={data}
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={async (todo) => {
            const exists = editing !== 'new' && data.todos.some((x) => x.id === todo.id);
            const todos = exists
              ? data.todos.map((x) => (x.id === todo.id ? todo : x))
              : [...data.todos, todo];
            await onUpdate({ ...data, todos });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function endOfWeek(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const day = new Date(utc).getUTCDay();
  const offset = day === 0 ? 0 : 7 - day;
  return new Date(utc + offset * 86400000).toISOString().slice(0, 10);
}

export { PRIO_LABEL };
