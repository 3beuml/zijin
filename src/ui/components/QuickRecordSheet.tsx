/**
 * 快速记录弹层：选学生（分包优先）→ 类型/内容 → 保存。
 * 今日页「记一笔」四个按钮与 dock 中键「+」共用；fixedType 传死类型，不传则弹层内可选。
 * v0.5：选完人后显示该生最近几条记录——老师补记时看得见上次写了什么，不容易记重；
 * 内容框加大并随内容长高（使用者反馈：框太小、打字时看不到相关记录）。
 */
import { useMemo, useState } from 'react';
import type { AppData } from '../../domain/types.ts';
import { recordsOf } from '../../domain/weekly.ts';
import { shortDate, todayStr } from '../util.ts';
import { IconClose } from '../icons.tsx';

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
  onSave: (studentId: string, rec: { date: string; type: string; content: string }) => Promise<void>;
  onOpenStudent: (id: string) => void;
}) {
  const [type, setType] = useState(fixedType ?? QUICK_TYPES[0]);
  const [studentId, setStudentId] = useState('');
  const [content, setContent] = useState('');
  const [kw, setKw] = useState('');
  const candidates = (defaultStudents.length ? defaultStudents : data.students).filter(
    (s) => !kw.trim() || s.name.includes(kw.trim()),
  );
  const recent = useMemo(
    () => (studentId ? recordsOf(data.records, studentId).slice(0, 3) : []),
    [data.records, studentId],
  );
  const studentName = data.students.find((s) => s.id === studentId)?.name ?? '';

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
              {studentName}
              <button className="link-btn" onClick={() => setStudentId('')}>
                换人
              </button>
            </div>
            {recent.length > 0 && (
              <div className="recent-records">
                <div className="recent-records-title">{studentName} 的最近记录</div>
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
              <button className="btn" onClick={() => onOpenStudent(studentId)}>
                去详情
              </button>
              <button
                className="btn primary"
                disabled={!content.trim()}
                onClick={() =>
                  void onSave(studentId, {
                    date: todayStr(),
                    type,
                    content: content.trim(),
                  })
                }
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
