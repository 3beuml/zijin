/** 记录编辑弹层：日期/类型/内容（学生固定），保存/删除回调由调用方实现 */
import { useState } from 'react';
import type { RecordItem } from '../../domain/types.ts';
import { todayStr } from '../util.ts';

const RECORD_TYPES = ['沟通', '谈心', '家访', '约谈', '其他'];

export function RecordEditSheet({
  record,
  onCancel,
  onSave,
  onDelete,
}: {
  record: RecordItem;
  onCancel: () => void;
  onSave: (next: RecordItem) => Promise<void>;
  onDelete: (rec: RecordItem) => Promise<void>;
}) {
  const [type, setType] = useState(record.type);
  const [date, setDate] = useState(record.date);
  const [content, setContent] = useState(record.content);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!content.trim() || busy) return;
    setBusy(true);
    await onSave({ ...record, type, date, content: content.trim() });
    setBusy(false);
  };

  const remove = async () => {
    if (busy) return;
    if (!confirm('删除这条记录？删除后不可恢复（除非有快照）。')) return;
    setBusy(true);
    await onDelete(record);
    setBusy(false);
  };

  return (
    <div className="sheet-mask" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="card-title">编辑记录</h2>
        <div className="form-col">
          <div className="form-row">
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="记录类型">
              {[...new Set([type, ...RECORD_TYPES])].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="日期" />
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="内容（发生了什么、约定了什么）"
          />
        </div>
        <div className="btn-row">
          <button className="btn danger" onClick={remove}>
            删除
          </button>
          <span className="spacer" />
          <button className="btn" onClick={onCancel}>
            取消
          </button>
          <button className="btn primary" disabled={!content.trim() || busy} onClick={save}>
            保存
          </button>
        </div>
        <p className="muted">记录于 {record.date} · 编辑会保留原始创建时间</p>
      </div>
    </div>
  );
}

/** 新记录的默认日期 */
export function newRecordDate(): string {
  return todayStr();
}
