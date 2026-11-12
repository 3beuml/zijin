/**
 * 记录页：全部学生的统一时间线（倒序），按类型筛选 + 关键词搜索，可编辑/删除。
 * 「上次跟谁家长聊过手机的事是哪天」——这类回溯就在这里。
 */
import { useMemo, useState } from 'react';
import type { AppData, RecordItem } from '../../domain/types.ts';
import { filterRecords, recordTypes } from '../../domain/records.ts';
import { shortDate } from '../util.ts';
import { RecordEditSheet } from '../components/RecordEditSheet.tsx';

export function RecordsScreen({
  data,
  onUpdate,
  onOpenStudent,
}: {
  data: AppData;
  onUpdate: (next: AppData) => Promise<void>;
  onOpenStudent: (id: string) => void;
}) {
  const [type, setType] = useState<string | null>(null);
  const [kw, setKw] = useState('');
  const [editing, setEditing] = useState<RecordItem | null>(null);

  const types = useMemo(() => recordTypes(data.records), [data.records]);
  const shown = useMemo(
    () => filterRecords(data.records, { type: type ?? undefined, keyword: kw }),
    [data.records, type, kw],
  );
  const nameOf = (id: string) => data.students.find((s) => s.id === id)?.name ?? '?';

  const save = async (next: RecordItem) => {
    await onUpdate({ ...data, records: data.records.map((r) => (r.id === next.id ? next : r)) });
    setEditing(null);
  };
  const remove = async (rec: RecordItem) => {
    await onUpdate({ ...data, records: data.records.filter((r) => r.id !== rec.id) });
    setEditing(null);
  };

  return (
    <div className="page">
      <h1 className="page-title">记录</h1>
      <div className="summary-line">{data.records.length} 条 · 点行里的姓名进学生档案</div>

      <input
        className="search"
        type="search"
        placeholder="搜记录内容 / 类型"
        value={kw}
        onChange={(e) => setKw(e.target.value)}
      />

      {types.length > 0 && (
        <div className="chip-row">
          <button className={`chip${type === null ? ' active' : ''}`} onClick={() => setType(null)}>
            全部 {data.records.length}
          </button>
          {types.map((t) => (
            <button
              key={t.type}
              className={`chip${type === t.type ? ' active' : ''}`}
              onClick={() => setType(type === t.type ? null : t.type)}
            >
              {t.type} {t.count}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="empty-hint">
          {data.records.length === 0 ? '还没有记录。到今日页「记一笔」开始。' : '没有符合条件的记录。'}
        </div>
      ) : (
        <ul className="list">
          {shown.slice(0, 200).map((r) => (
            <li key={r.id}>
              <div className="row record-row">
                <span className="row-main" onClick={() => onOpenStudent(r.studentId)} role="button">
                  <span className="row-name">
                    {nameOf(r.studentId)}
                    <span className="tag">{r.type}</span>
                  </span>
                  <span className="row-sub">{r.content}</span>
                </span>
                <span className="row-side rec-side">
                  <span className="tl-date">{shortDate(r.date)}</span>
                  <button className="link-btn" onClick={() => setEditing(r)}>
                    改
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {shown.length > 200 && <p className="muted">只显示最近 200 条，请用筛选缩小范围。</p>}

      {editing && <RecordEditSheet record={editing} onCancel={() => setEditing(null)} onSave={save} onDelete={remove} />}
    </div>
  );
}
