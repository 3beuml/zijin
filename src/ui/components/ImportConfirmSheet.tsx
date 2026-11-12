/**
 * 导入确认弹层（detect → map 的结果在这里人工确认）。
 * 「我的」与 dock 中键「+ → 导入成绩表」共用；列识别与确认交互完全一致。
 */
import { useState } from 'react';
import type { ImportMapping, SketchRole } from '../../domain/import/types.ts';

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

export interface PendingImport {
  fileName: string;
  table: (string | number | null)[][];
  sketchHeaderRows: number;
  mapping: ImportMapping;
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
  const lowConfidence = mapping.columns.filter((c) => c.confidence < 0.7 && c.role !== 'unknown');

  const setCol = (index: number, patch: Partial<ImportMapping['columns'][number]>) => {
    setMapping((m) => ({
      ...m,
      columns: m.columns.map((c) => (c.index === index ? { ...c, ...patch } : c)),
    }));
  };

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
        <div className="exam-label-row">
          <label>
            第1次
            <input
              value={mapping.examLabels[1] ?? ''}
              onChange={(e) => setMapping((m) => ({ ...m, examLabels: { ...m.examLabels, 1: e.target.value } }))}
            />
          </label>
          <label>
            第2次
            <input
              value={mapping.examLabels[2] ?? ''}
              onChange={(e) => setMapping((m) => ({ ...m, examLabels: { ...m.examLabels, 2: e.target.value } }))}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">列识别（{mapping.columns.length} 列）</h2>
        <table className="map-table">
          <tbody>
            {mapping.columns.map((c) => (
              <tr key={c.index} className={c.confidence < 0.7 ? 'low-conf' : ''}>
                <td className="map-idx num">{c.index}</td>
                <td className="map-header">{c.header}</td>
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
                  {(c.role === 'subject.score' || c.role === 'subject.rank' || c.role === 'subject.rankPrev' || c.role === 'tier') && (
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

      <button className="btn primary big" onClick={() => onConfirm(mapping)}>
        确认导入
      </button>
    </div>
  );
}
