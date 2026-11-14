/**
 * 快速记录弹层：选学生（分包优先）→ 类型/内容 → 保存。
 * 今日页「记一笔」四个按钮与 dock 中键「+」共用；fixedType 传死类型，不传则弹层内可选。
 * v0.6（teacher §5.3 交互）：保存后不关弹层，显示「已记录」可连着记下一条；
 * 支持多选学生（家长会一次记给多人的场景）。
 */
import { useState } from 'react';
import type { AppData } from '../../domain/types.ts';
import { recordsOf } from '../../domain/weekly.ts';
import { shortDate, todayStr } from '../util.ts';
import { IconClose, IconCheck } from '../icons.tsx';

const QUICK_TYPES = ['沟通', '谈心', '家访', '约谈', '其他'];

export function QuickRecordSheet({
  data,
  defaultStudents,
  fixedType,
  onClose,
  onSave,
  onOpenStudent,
}: {
  data: AppData;
  defaultStudents: AppData['students'];
  fixedType?: string;
  onClose: () => void;
  /** 保存一条（多选时会被依次调用多次）；弹层自己管理关闭 */
  onSave: (studentId: string, rec: { date: string; type: string; content: string }) => Promise<void>;
  onOpenStudent: (id: string) => void;
}) {
  const [type, setType] = useState(fixedType ?? QUICK_TYPES[0]);
  const [selected, setSelected] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [kw, setKw] = useState('');
  const [multi, setMulti] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const candidates = (defaultStudents.length ? defaultStudents : data.students).filter(
    (s) => !kw.trim() || s.name.includes(kw.trim()),
  );
  const recent = selected.length === 1 ? recordsOf(data.records, selected[0]).slice(0, 3) : [];
  const nameOf = (id: string) => data.students.find((s) => s.id === id)?.name ?? '?';

  const togglePick = (id: string) => {
    if (!multi) {
      setSelected([id]);
      return;
    }
    setSelected((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  };

  const save = async () => {
    if (!content.trim() || busy || selected.length === 0) return;
    setBusy(true);
    const rec = { date: todayStr(), type, content: content.trim() };
    for (const id of selected) {
      await onSave(id, rec);
    }
    setBusy(false);
    setSavedCount((n) => n + selected.length);
    setSelected([]);
    setContent('');
    setKw('');
  };

  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="card-title">快速{type}</h2>
          <button className="icon-btn" aria-label="关闭" onClick={onClose}>
            <IconClose size={18} />
          </button>
        </div>
        {!fixedType && (
          <div className="chip-row">
            {QUICK_TYPES.map((t) => (
              <button
                key={t}
                className={`chip${type === t ? ' active' : ''}`}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {savedCount > 0 && (
          <div className="saved-flash">
            <IconCheck size={16} /> 已记录 {savedCount} 条，接着选下一个学生；记完点右上角 × 关闭
          </div>
        )}
        {selected.length === 0 ? (
          <>
            <div className="chip-row">
              <button className={`chip${multi ? ' active' : ''}`} onClick={() => setMulti((v) => !v)}>
                {multi ? '✓ 多选模式（家长会等场景）' : '多选模式'}
              </button>
            </div>
            <input
              className="search"
              type="search"
              placeholder="搜学生姓名"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
            />
            <ul className={`list student-pick-list${multi ? ' multi' : ''}`}>
              {candidates.map((s) => (
                <li key={s.id}>
                  <button
                    className={`row compact${multi && selected.includes(s.id) ? ' picked' : ''}`}
                    onClick={() => togglePick(s.id)}
                  >
                    <span className="row-main">
                      <span className="row-name">
                        {multi && selected.includes(s.id) ? <IconCheck size={14} /> : null}
                        {s.name}
                      </span>
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
              {selected.map(nameOf).join('、')}
              <button className="link-btn" onClick={() => setSelected([])}>
                换人
              </button>
            </div>
            {recent.length > 0 && (
              <div className="recent-records">
                <div className="recent-records-title">{nameOf(selected[0])} 的最近记录</div>
                <ul>
                  {recent.map((r) => (
                    <li key={r.id}>
                      <span className="tl-date">{shortDate(r.date)}</span>
                      <span className="tag">{r.type}</span>
                      <span className="recent-content">{r.content}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <textarea
              className="autosize"
              placeholder={`${type}内容（发生了什么、约定了什么）`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
            <div className="btn-row">
              {selected.length === 1 && (
                <button className="btn" onClick={() => onOpenStudent(selected[0])}>
                  去详情
                </button>
              )}
              <button className="btn primary" disabled={!content.trim() || busy} onClick={() => void save()}>
                {multi && selected.length > 1 ? `保存（记给 ${selected.length} 人）` : '保存'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
