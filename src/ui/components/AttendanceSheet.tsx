/**
 * 考勤登记弹层（v0.6，teacher §5.3.6）：选学生 → 类型/时段/原因 → 保存。
 * 类型六选一：迟到/早退/病假/事假/旷课/离校；时段与原因可选。
 * 保存后弹层不关（显示「已记录」），可以连着给下一个学生记——考勤常常是一串人。
 */
import { useState } from 'react';
import type { AppData, Attendance, AttendanceType } from '../../domain/types.ts';
import { todayStr, nowIso, newId } from '../util.ts';
import { IconClose, IconCheck } from '../icons.tsx';

const TYPES: AttendanceType[] = ['迟到', '早退', '病假', '事假', '旷课', '离校'];

export function AttendanceSheet({
  data,
  fixedStudentId,
  onClose,
  onSave,
}: {
  data: AppData;
  /** 从学生详情进来时定死学生 */
  fixedStudentId?: string;
  onClose: () => void;
  onSave: (att: Attendance) => Promise<void>;
}) {
  const [studentId, setStudentId] = useState(fixedStudentId ?? '');
  const [kw, setKw] = useState('');
  const [type, setType] = useState<AttendanceType>('迟到');
  const [slot, setSlot] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const candidates = data.students.filter((s) => !kw.trim() || s.name.includes(kw.trim()));
  const studentName = data.students.find((s) => s.id === studentId)?.name ?? '';

  const save = async () => {
    if (!studentId || busy) return;
    setBusy(true);
    await onSave({
      id: newId('a'),
      studentId,
      date: todayStr(),
      slot: slot.trim() || undefined,
      type,
      reason: reason.trim() || undefined,
      createdAt: nowIso(),
    });
    setBusy(false);
    setSavedCount((n) => n + 1);
    setSlot('');
    setReason('');
    if (fixedStudentId) setStudentId(''); // 详情页进来：记完一个可以换人接着记
  };

  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="card-title">记考勤</h2>
          <button className="icon-btn" aria-label="关闭" onClick={onClose}>
            <IconClose size={18} />
          </button>
        </div>

        {savedCount > 0 && (
          <div className="saved-flash">
            <IconCheck size={16} /> 已记录 {savedCount} 条，可以接着记；记完点右上角 × 关闭
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
            <div className="chip-row">
              {TYPES.map((t) => (
                <button key={t} className={`chip${type === t ? ' active' : ''}`} onClick={() => setType(t)}>
                  {t}
                </button>
              ))}
            </div>
            <div className="form-col">
              <input
                placeholder="时段（可选）：如 早读 / 第3节 / 晚自习"
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
              />
              <input
                placeholder="原因（可选）：如 请假条已交"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <button className="btn primary big" disabled={busy} onClick={() => void save()}>
              保存
            </button>
          </>
        )}
      </div>
    </div>
  );
}
