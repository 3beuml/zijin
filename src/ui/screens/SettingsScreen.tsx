/**
 * 我的：导入成绩表（detect → map → 【人工确认】→ commit）、恢复 JSON、清空数据。
 * 备份导出与打印在阶段 4。
 */
import { useRef, useState } from 'react';
import type { AppData } from '../../domain/types.ts';
import { tableFromBuffer } from '../../lib/xlsx.ts';
import { detect } from '../../domain/import/detect.ts';
import { map } from '../../domain/import/map.ts';
import { commit } from '../../domain/import/commit.ts';
import { distinctAdvisors } from '../../domain/students.ts';
import type { ImportMapping, SketchRole } from '../../domain/import/types.ts';
import { downloadFile } from '../print.ts';
import { todayStr } from '../util.ts';
import { normalizeData } from '../../storage/db.ts';

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

interface PendingImport {
  fileName: string;
  table: (string | number | null)[][];
  sketchHeaderRows: number;
  mapping: ImportMapping;
}

export function SettingsScreen({
  data,
  onImported,
  onWipe,
  onGoWeekly,
}: {
  data: AppData;
  onImported: (next: AppData) => Promise<void>;
  onWipe: () => Promise<void>;
  onGoWeekly: () => void;
}) {
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [report, setReport] = useState<string[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [wipeArmed, setWipeArmed] = useState(false);
  const advisors = distinctAdvisors(data.students);

  const openFile = async (file: File) => {
    setReport(null);
    try {
      const buf = await file.arrayBuffer();
      const { table, sheetName } = await tableFromBuffer(buf);
      const sketch = detect(table);
      const mapping = map(table, sketch, [], {});
      setPending({ fileName: `${file.name}（${sheetName}）`, table, sketchHeaderRows: sketch.headerRows, mapping });
    } catch (e) {
      alert(`读表失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const doImport = async () => {
    if (!pending) return;
    const { table, mapping } = pending;
    const examLabels: Record<number, string> = {};
    for (const c of mapping.columns) {
      if (c.attempt) examLabels[c.attempt] = mapping.examLabels[c.attempt] ?? `第${c.attempt}次`;
    }
    const result = commit(data, table, mapping, { examLabels });
    await onImported(result.data);
    setPending(null);
    setReport([
      `新增学生 ${result.report.studentsCreated} 人（匹配已有 ${result.report.studentsMatched} 人）`,
      `新增考试 ${result.report.examsCreated} 场，写入分数 ${result.report.scoresWritten} 行`,
      ...result.report.droppedRows.map((d) => `第 ${d.row} 行未导入：${d.reason}`),
      ...result.report.warnings,
    ]);
  };

  const restore = async (file: File) => {
    if (!confirm('恢复备份会覆盖当前全部数据，确定？')) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppData;
      if (parsed.version !== 1 || !Array.isArray(parsed.students) || !Array.isArray(parsed.records)) {
        throw new Error('不是子衿的备份文件（version/字段不符）');
      }
      const normalized = normalizeData(parsed);
      await onImported(normalized);
      alert(
        `已恢复：${normalized.students.length} 名学生，${normalized.records.length} 条记录，${normalized.todos.length} 条待办`,
      );
    } catch (e) {
      alert(`恢复失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const wipe = async () => {
    if (!wipeArmed) {
      setWipeArmed(true);
      return;
    }
    if (confirm('真的要清空全部数据吗？此操作不可撤销。')) {
      await onWipe();
    }
    setWipeArmed(false);
  };

  return (
    <div className="page">
      <h1 className="page-title">我的</h1>

      {report && (
        <section className="card report">
          <h2 className="card-title">上次导入结果</h2>
          <ul className="plain-list">
            {report.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {pending ? (
        <ImportConfirm pending={pending} onCancel={() => setPending(null)} onConfirm={doImport} />
      ) : (
        <>
          <section className="card" onClick={onGoWeekly} role="button" aria-label="打开周手册">
            <h2 className="card-title">周工作手册</h2>
            <p className="muted">登记表 · 下周重点 · 导出 Excel / A4 / 打印（周五交材料用）</p>
          </section>

          {advisors.length > 0 && (
            <section className="card">
              <h2 className="card-title">分包</h2>
              <p className="muted">
                设置「我是哪位导师」后，学生列表默认只看你的学生，周手册按你的分包生成。
              </p>
              <select
                className="advisor-select"
                value={data.settings.advisor}
                aria-label="我是哪位导师"
                onChange={(e) => void onImported({ ...data, settings: { advisor: e.target.value } })}
              >
                <option value="">未设置</option>
                {advisors.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </section>
          )}

          <section className="card">
            <h2 className="card-title">导入成绩表</h2>
            <p className="muted">
              支持 .xlsx。先自动识别列，再由你确认；识别不准的列会标黄。
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void openFile(f);
                e.target.value = '';
              }}
            />
            <button className="btn primary" onClick={() => fileRef.current?.click()}>
              选择成绩表文件
            </button>
          </section>

          <section className="card">
            <h2 className="card-title">备份</h2>
            <p className="muted">
              备份是完整 JSON（学生/考试/成绩/记录），可存档或搬到新手机；恢复会覆盖当前数据。
            </p>
            <input
              ref={restoreRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void restore(f);
                e.target.value = '';
              }}
            />
            <div className="btn-row">
              <button
                className="btn"
                onClick={() => {
                  const name = `子衿备份-${todayStr()}.json`;
                  downloadFile(JSON.stringify(data, null, 2), name, 'application/json');
                  alert(`已生成 ${name}`);
                }}
              >
                导出备份 JSON
              </button>
              <button className="btn" onClick={() => restoreRef.current?.click()}>
                恢复备份…
              </button>
            </div>
          </section>

          <section className="card">
            <h2 className="card-title">数据</h2>
            <p className="muted">
              当前 {data.students.length} 名学生 · {data.exams.length} 场考试 · {data.records.length} 条记录。
              数据只存在本机。
            </p>
            <button className={`btn ${wipeArmed ? 'danger-solid' : 'danger'}`} onClick={wipe}>
              {wipeArmed ? '再点一次确认清空' : '清空全部数据…'}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function ImportConfirm({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingImport;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [mapping, setMapping] = useState<ImportMapping>(pending.mapping);
  const lowConfidence = mapping.columns.filter((c) => c.confidence < 0.7 && c.role !== 'unknown');

  const setCol = (index: number, patch: Partial<import('../../domain/import/types.ts').MappingColumn>) => {
    setMapping((m) => ({
      ...m,
      columns: m.columns.map((c) => (c.index === index ? { ...c, ...patch } : c)),
    }));
  };

  return (
    <div className="page">
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

      <button className="btn primary big" onClick={onConfirm}>
        确认导入
      </button>
    </div>
  );
}
