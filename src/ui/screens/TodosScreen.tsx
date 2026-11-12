/** 待办：今日 / 本周 / 全部 / 已完成；逾期红色置顶；完成可撤销 */
import { useMemo, useState } from 'react';
import type { AppData, Todo } from '../../domain/types.ts';
import { todoViews, toggleTodo, todosDueBetween } from '../../domain/todo.ts';
import { newId, nowIso, todayStr } from '../util.ts';

const TYPES = ['家校', '学生', '教学', '班级', '行政'];
const PRIORITIES: { value: Todo['priority']; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'mid', label: '中' },
  { value: 'high', label: '高' },
];
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

function TodoForm({
  data,
  initial,
  onCancel,
  onSave,
}: {
  data: AppData;
  initial: Todo | null;
  onCancel: () => void;
  onSave: (t: Todo) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState(initial?.type ?? TYPES[0]);
  const [priority, setPriority] = useState<Todo['priority']>(initial?.priority ?? 'mid');
  const [due, setDue] = useState(initial?.due ?? todayStr());
  const [studentId, setStudentId] = useState(initial?.studentId ?? '');

  const save = async () => {
    if (!title.trim()) return;
    const todo: Todo = initial
      ? { ...initial, title: title.trim(), type, priority, due, studentId: studentId || undefined }
      : {
          id: newId('t'),
          title: title.trim(),
          type,
          priority,
          due,
          status: 'open',
          studentId: studentId || undefined,
          createdAt: nowIso(),
        };
    await onSave(todo);
  };

  return (
    <div className="sheet-mask" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="card-title">{initial ? '编辑待办' : '新建待办'}</h2>
        <div className="form-col">
          <input
            placeholder="要做什么？（如：周五前回访家长）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <div className="form-row">
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="类型">
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Todo['priority'])}
              aria-label="优先级"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  优先级：{p.label}
                </option>
              ))}
            </select>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="截止" />
          </div>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="关联学生">
            <option value="">不关联学生</option>
            {data.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={onCancel}>
            取消
          </button>
          <button className="btn primary" disabled={!title.trim()} onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export { PRIO_LABEL };
