/**
 * 子衿 · 应用壳。
 * dock：今日 | 学生 | ＋(动作盘) | 待办 | 我的 —— 参考 teacher「4 主入口 + 中间快速动作」。
 * ＋ 弹出：记一笔 / 新建待办 / 导入成绩表（导入从任何页面两下可达）。
 * 全屏页（周手册 / 成绩分析 / 全部记录）走 screen-overlay，不占 tabbar 席位。
 */
import { useEffect, useRef, useState } from 'react';
import type { AppData, RecordItem, Todo } from '../domain/types.ts';
import { emptyData, loadData, saveData, clearData, takeDailySnapshot } from '../storage/db.ts';
import { detect } from '../domain/import/detect.ts';
import { map } from '../domain/import/map.ts';
import { commit } from '../domain/import/commit.ts';
import type { ImportMapping } from '../domain/import/types.ts';
import { tableFromBuffer } from '../lib/xlsx.ts';
import { HomeScreen } from './screens/HomeScreen';
import { StudentsScreen } from './screens/StudentsScreen';
import { StudentDetail } from './screens/StudentDetail';
import { RecordsScreen } from './screens/RecordsScreen';
import { WeeklyScreen } from './screens/WeeklyScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TodosScreen } from './screens/TodosScreen';
import { ExamsScreen } from './screens/ExamsScreen';
import { SearchOverlay } from './components/SearchOverlay.tsx';
import { QuickRecordSheet } from './components/QuickRecordSheet.tsx';
import { TodoForm } from './components/TodoForm.tsx';
import { ImportConfirmSheet, type PendingImport } from './components/ImportConfirmSheet.tsx';
import { myStudents } from '../domain/students.ts';

type Tab = 'home' | 'students' | 'todos' | 'mine';

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [examsOpen, setExamsOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [plusTodoOpen, setPlusTodoOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickType, setQuickType] = useState<string | undefined>(undefined);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData().then((d) => {
      const next = d ?? emptyData();
      setData(next);
      setLoaded(true);
      // 每天首次打开自动快照（失败不打扰使用，只是少了保险）
      takeDailySnapshot(next, new Date().toISOString().slice(0, 10)).catch(() => {});
    });
  }, []);

  if (!loaded || data == null) {
    return <div className="page loading">读取本地数据…</div>;
  }

  /** 所有写操作都走这里：改状态 + 落 IndexedDB */
  const persist = async (next: AppData): Promise<void> => {
    setData(next);
    try {
      await saveData(next);
    } catch (e) {
      alert(`保存失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const addRecord = async (
    studentId: string,
    rec: Omit<RecordItem, 'id' | 'studentId' | 'createdAt'>,
    followUp?: { title: string; due: string },
  ) => {
    const id = `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
    const todos: Todo[] = [...data.todos];
    if (followUp && followUp.title.trim()) {
      todos.push({
        id: `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
        title: followUp.title.trim(),
        type: '家校',
        priority: 'mid',
        due: followUp.due,
        status: 'open',
        studentId,
        createdAt: new Date().toISOString(),
      });
    }
    await persist({
      ...data,
      records: [...data.records, { ...rec, id, studentId, createdAt: new Date().toISOString() }],
      todos,
    });
  };

  const wipeAll = async () => {
    await clearData();
    setData(emptyData());
  };

  /* ---- ＋ → 导入成绩表：任何页面两下可达 ---- */
  const openImportPicker = () => {
    setPlusOpen(false);
    importFileRef.current?.click();
  };
  const onImportFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const { table, sheetName } = await tableFromBuffer(buf);
      const sketch = detect(table);
      const mapping = map(table, sketch, [], {});
      setPendingImport({
        fileName: `${file.name}（${sheetName}）`,
        table,
        sketchHeaderRows: sketch.headerRows,
        mapping,
      });
    } catch (e) {
      alert(`读表失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const confirmImport = async (mapping: ImportMapping) => {
    if (!pendingImport) return;
    const examLabels: Record<number, string> = {};
    for (const c of mapping.columns) {
      if (c.attempt) examLabels[c.attempt] = mapping.examLabels[c.attempt] ?? `第${c.attempt}次`;
    }
    const result = commit(data, pendingImport.table, mapping, { examLabels });
    await persist(result.data);
    setPendingImport(null);
    alert(
      [
        `导入完成：新增学生 ${result.report.studentsCreated} 人（匹配已有 ${result.report.studentsMatched}）`,
        `新增考试 ${result.report.examsCreated} 场，写入分数 ${result.report.scoresWritten} 行`,
        ...(result.report.droppedRows.length
          ? [`未导入行：${result.report.droppedRows.map((d) => `r${d.row} ${d.reason}`).join('；')}`]
          : []),
        ...result.report.warnings.slice(0, 6),
      ].join('\n'),
    );
  };

  const scopeStudents = myStudents(data.students, data.settings.advisor);

  return (
    <div className="app">
      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xlsm"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImportFile(f);
          e.target.value = '';
        }}
      />

      <main className="app-main">
        {tab === 'home' && (
          <HomeScreen
            data={data}
            onUpdate={persist}
            onOpenStudent={setDetailId}
            onGoStudents={() => setTab('students')}
            onGoTodos={() => setTab('todos')}
            onGoWeekly={() => setWeeklyOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
          />
        )}
        {tab === 'students' &&
          (detailId ? (
            <StudentDetail
              data={data}
              studentId={detailId}
              onBack={() => setDetailId(null)}
              onAddRecord={addRecord}
              onUpdate={persist}
            />
          ) : (
            <StudentsScreen data={data} onOpenStudent={setDetailId} />
          ))}
        {tab === 'todos' && <TodosScreen data={data} onUpdate={persist} />}
        {tab === 'mine' && (
          <SettingsScreen
            data={data}
            onImported={persist}
            onWipe={wipeAll}
            onGoWeekly={() => setWeeklyOpen(true)}
            onGoExams={() => setExamsOpen(true)}
            onGoRecords={() => setRecordsOpen(true)}
            onGoImport={openImportPicker}
          />
        )}
      </main>

      {weeklyOpen && (
        <div className="screen-overlay">
          <WeeklyScreen data={data} onOpenStudent={setDetailId} onBack={() => setWeeklyOpen(false)} />
        </div>
      )}

      {examsOpen && (
        <div className="screen-overlay">
          <ExamsScreen data={data} onOpenStudent={setDetailId} onBack={() => setExamsOpen(false)} />
        </div>
      )}

      {recordsOpen && (
        <div className="screen-overlay">
          <RecordsScreen
            data={data}
            onUpdate={persist}
            onOpenStudent={(id) => {
              setRecordsOpen(false);
              setTab('students');
              setDetailId(id);
            }}
            onBack={() => setRecordsOpen(false)}
          />
        </div>
      )}

      {searchOpen && (
        <SearchOverlay data={data} onClose={() => setSearchOpen(false)} onOpenStudent={setDetailId} />
      )}

      {plusOpen && (
        <div className="sheet-mask" onClick={() => setPlusOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">添加</h2>
            <div className="plus-grid">
              {(
                [
                  ['沟通', () => { setQuickType('沟通'); setQuickOpen(true); setPlusOpen(false); }],
                  ['谈心', () => { setQuickType('谈心'); setQuickOpen(true); setPlusOpen(false); }],
                  ['家访', () => { setQuickType('家访'); setQuickOpen(true); setPlusOpen(false); }],
                  ['其他', () => { setQuickType('其他'); setQuickOpen(true); setPlusOpen(false); }],
                ] as [string, () => void][]
              ).map(([t, go]) => (
                <button key={t} className="quick-btn" onClick={go}>
                  {t}
                </button>
              ))}
            </div>
            <div className="plus-list">
              <button className="row compact" onClick={() => { setQuickType(undefined); setQuickOpen(true); setPlusOpen(false); }}>
                <span className="row-main">
                  <span className="row-name">记一笔（选类型）</span>
                </span>
                <span className="row-side">›</span>
              </button>
              <button className="row compact" onClick={() => { setPlusOpen(false); setPlusTodoOpen(true); }}>
                <span className="row-main">
                  <span className="row-name">新建待办</span>
                </span>
                <span className="row-side">›</span>
              </button>
              <button className="row compact" onClick={openImportPicker}>
                <span className="row-main">
                  <span className="row-name">导入成绩表（.xlsx）</span>
                  <span className="row-sub">自动识别列，确认后落库</span>
                </span>
                <span className="row-side">›</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {quickOpen && (
        <QuickRecordSheet
          data={data}
          defaultStudents={scopeStudents}
          fixedType={quickType}
          onClose={() => {
            setQuickOpen(false);
            setQuickType(undefined);
          }}
          onSave={async (studentId, rec) => {
            await addRecord(studentId, rec);
            setQuickOpen(false);
            setQuickType(undefined);
          }}
          onOpenStudent={(id) => {
            setPlusOpen(false);
            setQuickOpen(false);
            setQuickType(undefined);
            setTab('students');
            setDetailId(id);
          }}
        />
      )}
      {plusTodoOpen && (
        <TodoForm
          data={data}
          initial={null}
          onCancel={() => setPlusTodoOpen(false)}
          onSave={async (todo) => {
            await persist({ ...data, todos: [...data.todos, todo] });
            setPlusTodoOpen(false);
          }}
        />
      )}

      {pendingImport && (
        <ImportConfirmSheet
          pending={pendingImport}
          onCancel={() => setPendingImport(null)}
          onConfirm={(m) => void confirmImport(m)}
        />
      )}

      {detailId == null && !weeklyOpen && !examsOpen && !recordsOpen && !pendingImport && (
        <nav className="tabbar">
          <button className={`tabbar-item${tab === 'home' ? ' active' : ''}`} onClick={() => setTab('home')}>
            今日
          </button>
          <button className={`tabbar-item${tab === 'students' ? ' active' : ''}`} onClick={() => setTab('students')}>
            学生
          </button>
          <button className="tabbar-plus" aria-label="添加" onClick={() => setPlusOpen(true)}>
            <span className="plus-disc">＋</span>
          </button>
          <button className={`tabbar-item${tab === 'todos' ? ' active' : ''}`} onClick={() => setTab('todos')}>
            待办
          </button>
          <button className={`tabbar-item${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>
            我的
          </button>
        </nav>
      )}
    </div>
  );
}
