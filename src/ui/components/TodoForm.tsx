/** 新建/编辑待办弹层（待办页与「+」动作盘共用） */
import { useState } from 'react';
import type { AppData, Todo } from '../../domain/types.ts';
import { todayStr, newId, nowIso } from '../util.ts';

const TYPES = ['家校', '学生', '教学', '班级', '行政'];
const PRIORITIES: { value: Todo['priority']; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'mid', label: '中' },
  { value: 'high', label: '高' },
];

export function TodoForm({
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
