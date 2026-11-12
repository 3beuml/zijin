/**
 * 导入确认弹层（detect → map 的结果在这里人工确认）。
 * 「我的」与 dock 中键「+ → 导入成绩表」共用；列识别与确认交互完全一致。
 * v0.5：每列显示表内真实数据样例（老师不用凭列名猜）；确认前实时校验，
 * 缺姓名列 / 分数列没填科目名时不能点确认——不再等到落库才被拒绝。
 */
import { useMemo, useState } from 'react';
import type { ImportMapping, SketchRole } from '../../domain/import/types.ts';
import type { Cell } from '../../domain/import/types.ts';

const ROLES: SketchRole[] = [
  'student.name', 'student.class', 'exam.total', 'exam.rank',
  'subject.score', 'subject.rank', 'subject.rankPrev', 'tier',
  'advisor', 'derived', 'unknown',
];

const ROLE_LABEL: Record<SketchRole, string> = {
  'student.name': '姓名',
  'student.class': '班级',
  'exam.total': '总分',
  'exam.rank': '名次(全表)',
  'subject.score': '分数',
  'subject.rank': '名次',
  'subject.rankPrev': '上次名次',
  tier: '分层',
  advisor: '导师',
  derived: '派生(不导入)',
  unknown: '不导入',
};

/** 需要科目名的角色：没填科目名就没法落库，确认前拦住 */
const SUBJECT_ROLES: SketchRole[] = ['subject.score', 'subject.rank', 'subject.rankPrev', 'tier'];

export interface PendingImport {
  fileName: string;
  table: (string | number | null)[][];
  sketchHeaderRows: number;
  mapping: ImportMapping;
}

/** 取该列数据区里前 n 个非空值作样例 */
function sampleValues(table: Cell[][], colIndex: number, startRow: number, endRow: number, n: number): string[] {
  const out: string[] = [];
  for (let r = startRow; r <= endRow && out.length < n; r++) {
    const v = table[r - 1]?.[colIndex - 1];
    if (v == null) continue;
    const t = String(v).trim();
    if (t === '') continue;
    out.push(t.length > 8 ? `${t.slice(0, 8)}…` : t);
  }
  return out;
}

export function ImportConfirmSheet({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingImport;
  onCancel: () => void;
  onConfirm: (mapping: ImportMapping) => void;
}) {
  const [mapping, setMapping] = useState<ImportMapping>(pending.mapping);

  const setCol = (index: number, patch: Partial<ImportMapping['columns'][number]>) => {
    setMapping((m) => ({
      ...m,
      columns: m.columns.map((c) => (c.index === index ? { ...c, ...patch } : c)),
    }));
  };

  // 每列的数据样例（数据区不变，算一次就够）
  const samples = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const c of pending.mapping.columns) {
      m.set(
        c.index,
        sampleValues(pending.table, c.index, pending.mapping.dataStartRow, pending.mapping.dataEndRow, 2),
      );
    }
    return m;
  }, [pending]);

  // 出现过的次别（决定「考试命名」显示几格；一般 1~3 次）
  const attempts = useMemo(() => {
    const s = new Set<number>();
    for (const c of mapping.columns) {
      if (c.role !== 'unknown' && c.role !== 'student.name' && c.role !== 'student.class' && c.role !== 'advisor' && c.role !== 'derived' && c.attempt) {
        s.add(c.attempt);
      }
    }
    return [...s].sort((a, b) => a - b);
  }, [mapping.columns]);

  // 确认前校验：全部通过才能落库
  const issues = useMemo(() => {
    const out: string[] = [];
    const nameCols = mapping.columns.filter((c) => c.role === 'student.name');
    if (nameCols.length === 0) out.push('还没有指定「姓名」列——不知道每行是谁，无法导入');
    if (nameCols.length > 1) out.push(`有 ${nameCols.length} 列都被指定为「姓名」（列 ${nameCols.map((c) => c.index).join('、')}），请只保留一列`);
    for (const c of mapping.columns) {
      if (SUBJECT_ROLES.includes(c.role) && !(c.subject ?? '').trim()) {
        out.push(`列 ${c.index}「${c.header || '空表头'}」是${ROLE_LABEL[c.role]}列，但「科目」没填——不填的话这一列会被忽略`);
      }
    }
    const scoreRoles = mapping.columns.filter((c) => SUBJECT_ROLES.includes(c.role));
    if (scoreRoles.length === 0) {
      out.push('没有指定任何「分数 / 名次 / 分层」列——这样只会建学生名单，不带成绩');
    }
    return out;
  }, [mapping.columns]);

  const lowConfidence = mapping.columns.filter((c) => c.confidence < 0.7 && c.role !== 'unknown');

  return (
    <div className="screen-overlay">
      <button className="back" onClick={onCancel}>
        ‹ 取消
      </button>
      <h1 className="page-title">确认导入</h1>
      <div className="summary-line">{pending.fileName}</div>

      {pending.mapping.warnings.length > 0 && (
        <section className="card warn-card">
          <ul className="plain-list">
            {pending.mapping.warnings.map((w, i) => (
              <li key={i}>⚠ {w}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">考试命名</h2>
        <p className="muted">给这两次考试起好名字（如「期中」「十月月考」），以后成绩分析里就按这个名字显示。</p>
        <div className="exam-label-row">
          {attempts.map((a) => (
            <label key={a}>
              第{a}次
              <input
                value={mapping.examLabels[a] ?? ''}
                placeholder={a === 1 ? '上次' : '本次'}
                onChange={(e) => setMapping((m) => ({ ...m, examLabels: { ...m.examLabels, [a]: e.target.value } }))}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">列识别（{mapping.columns.length} 列）</h2>
        <p className="muted">
          「表内数据」是从表里取的真实样例，照着它核对识别得对不对；改不对的用下拉框换。
        </p>
        <table className="map-table">
          <tbody>
            {mapping.columns.map((c) => (
              <tr key={c.index} className={c.confidence < 0.7 ? 'low-conf' : ''}>
                <td className="map-idx num">{c.index}</td>
                <td className="map-cell">
                  <div className="map-header" title={c.header}>{c.header || '（空表头）'}</div>
                  <div className="map-sample">{samples.get(c.index)?.join(' / ') || '—'}</div>
                </td>
                <td>
                  <select
                    value={c.role}
                    onChange={(e) => setCol(c.index, { role: e.target.value as SketchRole })}
                    aria-label={`列 ${c.index} 角色`}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {SUBJECT_ROLES.includes(c.role) && (
                    <input
                      className="subject-input"
                      value={c.subject ?? ''}
                      placeholder="科目"
                      onChange={(e) => setCol(c.index, { subject: e.target.value })}
                    />
                  )}
                </td>
                <td>
                  {c.role !== 'student.name' && c.role !== 'student.class' && c.role !== 'advisor' && c.role !== 'unknown' && c.role !== 'derived' && (
                    <select
                      value={c.attempt ?? ''}
                      onChange={(e) => setCol(c.index, { attempt: e.target.value ? Number(e.target.value) : undefined })}
                      aria-label={`列 ${c.index} 次别`}
                    >
                      <option value="">—</option>
                      <option value={1}>第1次</option>
                      <option value={2}>第2次</option>
                      <option value={3}>第3次</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lowConfidence.length > 0 && (
          <p className="muted">标黄行列的识别把握不大，请逐列核对。</p>
        )}
      </section>

      {issues.length > 0 && (
        <section className="card warn-card">
          <h2 className="card-title">先解决这些再导入（{issues.length}）</h2>
          <ul className="plain-list">
            {issues.map((s, i) => (
              <li key={i}>✋ {s}</li>
            ))}
          </ul>
        </section>
      )}

      <button
        className="btn primary big"
        disabled={issues.length > 0}
        onClick={() => onConfirm(mapping)}
      >
        {issues.length > 0 ? '上面的问题解决后才能导入' : '确认导入'}
      </button>
    </div>
  );
}
