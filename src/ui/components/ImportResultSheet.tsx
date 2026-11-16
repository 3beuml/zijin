/**
 * 导入结果页（v0.5）：替代 alert 弹长文本。
 * 数字大、警告全列、未导入行折叠——老师能逐条看懂这次导入到底发生了什么。
 */
import { useState } from 'react';
import type { CommitReport } from '../../domain/import/types.ts';
import { IconCheck } from '../icons.tsx';

export function ImportResultSheet({
  fileName,
  report,
  onClose,
}: {
  fileName: string;
  report: CommitReport;
  onClose: () => void;
}) {
  const [showDropped, setShowDropped] = useState(false);
  const nums = [
    { label: '新增学生', value: report.studentsCreated },
    { label: '匹配已有', value: report.studentsMatched },
    { label: '新增考试', value: report.examsCreated },
    { label: '写入分数', value: report.scoresWritten },
    ...(report.scoresUpdated > 0 ? [{ label: '更新分数', value: report.scoresUpdated }] : []),
  ];

  return (
    <div className="screen-overlay">
      <h1 className="page-title">导入完成</h1>
      <div className="summary-line">{fileName}</div>

      <section className="card">
        <div className="result-headline">
          <span className="result-ok-icon">
            <IconCheck size={22} />
          </span>
          <span className="result-ok-text">
            数据已存入本机
            {report.studentsCreated === 0 && report.studentsMatched > 0
              ? '（没有新学生，已有学生的分数已刷新）'
              : ''}
          </span>
        </div>
        <div className="result-nums">
          {nums.map((n) => (
            <div key={n.label} className="result-num-cell">
              <span className="result-num num">{n.value}</span>
              <span className="result-num-label">{n.label}</span>
            </div>
          ))}
        </div>
      </section>

      {report.droppedRows.length > 0 && (
        <section className="card warn-card">
          <h2 className="card-title">未导入的行（{report.droppedRows.length}）</h2>
          {showDropped ? (
            <ul className="plain-list">
              {report.droppedRows.map((d, i) => (
                <li key={i}>第 {d.row} 行 · {d.reason}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              {report.droppedRows.slice(0, 3).map((d) => `第 ${d.row} 行 ${d.reason}`).join('；')}
              {report.droppedRows.length > 3 ? ' …' : ''}
            </p>
          )}
          <button className="link-btn" onClick={() => setShowDropped((v) => !v)}>
            {showDropped ? '收起' : `展开全部 ${report.droppedRows.length} 条`}
          </button>
        </section>
      )}

      {report.warnings.length > 0 && (
        <section className="card warn-card">
          <h2 className="card-title">需要留意（{report.warnings.length}）</h2>
          <ul className="plain-list">
            {report.warnings.map((w, i) => (
              <li key={i}>⚠ {w}</li>
            ))}
          </ul>
        </section>
      )}

      <button className="btn primary big" onClick={onClose}>
        知道了
      </button>
    </div>
  );
}
