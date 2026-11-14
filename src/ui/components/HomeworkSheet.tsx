/**
 * 作业登记弹层（v0.6，teacher §5.3.3）：日期/科目 → 33 人名单平铺，默认「交」，
 * 点一下循环切换 交→未交→迟交→补交→免交；可只看未交。
 * initial 传入时为编辑模式（改完保存覆盖同一条）；可删除。
 * 验收口径照 teacher：33 人一次登记 ≤ 2 分钟。
 */
import { useMemo, useState } from 'react';
import type { AppData, Homework, HomeworkStatus } from '../../domain/types.ts';
import { todayStr, nowIso, newId } from '../util.ts';
import { IconClose } from '../icons.tsx';

const CYCLE: HomeworkStatus[] = ['交', '未交', '迟交', '补交', '免交'];

const STATUS_CLASS: Record<HomeworkStatus, string> = {
  交: 'hw-ok',
  未交: 'hw-miss',
  迟交: 'hw-warn',
  补交: 'hw-warn',
  免交: 'hw-free',
};

export function HomeworkSheet({
  data,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  data: AppData;
  /** 编辑模式传入已有作业 */
  initial?: Homework | null;
  onClose: () => void;
  onSave: (hw: Homework) => Promise<void>;
  onDelete?: (hw: Homework) => Promise<void>;
}) {
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [statuses, setStatuses] = useState<Map<string, HomeworkStatus>>(() => {
    const m = new Map<string, HomeworkStatus>();
    if (initial) for (const r of initial.records) m.set(r.studentId, r.status);
    else for (const s of data.students) m.set(s.id, '交');
    return m;
  });
  const [kw, setKw] = useState('');
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const cycle = (studentId: string) => {
    setStatuses((m) => {
      const next = new Map(m);
      const cur = next.get(studentId) ?? '交';
      next.set(studentId, CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length]);
      return next;
    });
  };

  const missedCount = useMemo(
    () => [...statuses.values()].filter((s) => s === '未交').length,
    [statuses],
  );

  const shown = data.students.filter((s) => {
    if (kw.trim() && !s.name.includes(kw.trim())) return false;
    if (onlyMissed && statuses.get(s.id) !== '未交') return false;
    return true;
  });

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const hw: Homework = {
      id: initial?.id ?? newId('h'),
      date,
      subject: subject.trim() || undefined,
      content: content.trim() || undefined,
      records: data.students.map((s) => ({ studentId: s.id, status: statuses.get(s.id) ?? '交' })),
      createdAt: initial?.createdAt ?? nowIso(),
    };
    await onSave(hw);
    setBusy(false);
  };

  const remove = async () => {
    if (!initial || !onDelete || busy) return;
    if (!confirm(`删除 ${date} 这条作业登记？统计会一起消失。`)) return;
    setBusy(true);
    await onDelete(initial);
    setBusy(false);
  };

  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="card-title">{initial ? '改作业登记' : '作业登记'}</h2>
          <button className="icon-btn" aria-label="关闭" onClick={onClose}>
            <IconClose size={18} />
          </button>
        </div>

        <div className="form-row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="日期" />
          <input placeholder="科目（可选）" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <input
          className="followup-input"
          placeholder="作业内容（可选）：如 练习册 P23 第 1–8 题"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div className="chip-row">
          <button className={`chip${!onlyMissed ? ' active' : ''}`} onClick={() => setOnlyMissed(false)}>
            全部 {data.students.length}
          </button>
          <button className={`chip${onlyMissed ? ' active' : ''}`} onClick={() => setOnlyMissed(true)}>
            只看未交 {missedCount}
          </button>
        </div>

        <input
          className="search"
          type="search"
          placeholder="搜学生姓名"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
        />

        <ul className="list student-pick-list hw-list">
          {shown.map((s) => {
            const st = statuses.get(s.id) ?? '交';
            return (
              <li key={s.id}>
                <button className="row compact hw-row" onClick={() => cycle(s.id)}>
                  <span className="row-main">
                    <span className="row-name">{s.name}</span>
                  </span>
                  <span className={`hw-status ${STATUS_CLASS[st]}`}>{st}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="muted">点一下切换：交 → 未交 → 迟交 → 补交 → 免交</p>

        <div className="btn-row">
          {initial && onDelete && (
            <button className="btn danger" onClick={() => void remove()}>
              删除
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" disabled={busy || !date} onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
