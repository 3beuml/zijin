/**
 * 我的：分包设置、周手册/成绩分析/全部记录入口、备份恢复、每日快照、清空。
 * 导入走 App 级触发（dock 中键与这里共用同一条流程）。
 */
import { useEffect, useRef, useState } from 'react';
import type { AppData } from '../../domain/types.ts';
import { distinctAdvisors } from '../../domain/students.ts';
import { downloadFile } from '../print.ts';
import { todayStr } from '../util.ts';
import { normalizeData, listSnapshots, type Snapshot } from '../../storage/db.ts';

export function SettingsScreen({
  data,
  onImported,
  onWipe,
  onGoWeekly,
  onGoExams,
  onGoRecords,
  onGoImport,
}: {
  data: AppData;
  onImported: (next: AppData) => Promise<void>;
  onWipe: () => Promise<void>;
  onGoWeekly: () => void;
  onGoExams: () => void;
  onGoRecords: () => void;
  onGoImport: () => void;
}) {
  const [report] = useState<string[] | null>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [wipeArmed, setWipeArmed] = useState(false);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const advisors = distinctAdvisors(data.students);

  useEffect(() => {
    listSnapshots()
      .then(setSnaps)
      .catch(() => setSnaps([]));
  }, []);

  const restoreSnapshot = async (snap: Snapshot) => {
    if (!confirm(`恢复到 ${snap.date} 的快照？会覆盖当前数据。`)) return;
    await onImported(normalizeData(snap.data));
    alert(`已恢复 ${snap.date} 的快照`);
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

      <section className="card" onClick={onGoWeekly} role="button" aria-label="打开周手册">
        <h2 className="card-title">周工作手册</h2>
        <p className="muted">登记表 · 下周重点 · 导出 Excel / A4 / 打印（周五交材料用）</p>
      </section>

      <section className="card" onClick={onGoExams} role="button" aria-label="打开成绩分析">
        <h2 className="card-title">成绩分析</h2>
        <p className="muted">各科班均 / 总分前三 / 每生与班均差（考后看）</p>
      </section>

      <section className="card" onClick={onGoRecords} role="button" aria-label="打开全部记录">
        <h2 className="card-title">全部记录</h2>
        <p className="muted">
          {data.records.length} 条沟通/谈心/家访记录的统一时间线，可查可改（换名字、约错了时间都在这改）
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">导入成绩表</h2>
        <p className="muted">
          支持 Excel（.xlsx）和 CSV 文件。先自动识别列，再由你确认；识别不准的列会标黄。
          （底部中间的 ＋ 键里也能导入）
        </p>
        <button className="btn primary" onClick={onGoImport}>
          选择成绩表文件
        </button>
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
        <h2 className="card-title">备份</h2>
        <p className="muted">
          备份是完整 JSON（学生/考试/成绩/记录/待办），可存档或搬到新手机；恢复会覆盖当前数据。
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

      {snaps.length > 0 && (
        <section className="card">
          <h2 className="card-title">每日快照（自动保留 7 天）</h2>
          <ul className="plain-list">
            {snaps.map((s) => (
              <li key={s.date} className="snap-row">
                <span>
                  {s.date} · {s.data.students.length} 学生 / {s.data.records.length} 记录
                </span>
                <button className="link-btn" onClick={() => void restoreSnapshot(s)}>
                  恢复
                </button>
              </li>
            ))}
          </ul>
          <p className="muted">每天首次打开 App 时自动拍一次；误删可回退。</p>
        </section>
      )}

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
    </div>
  );
}
