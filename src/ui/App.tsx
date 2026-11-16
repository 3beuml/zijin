/**
 * 子衿 · 应用壳。
 * dock：今日 | 学生 | ＋(动作盘) | 待办 | 我的 —— 参考 teacher「4 主入口 + 中间快速动作」。
 * ＋ 弹出：记一笔 / 新建待办 / 导入成绩表（导入从任何页面两下可达）。
 * 全屏页（周手册 / 成绩分析 / 全部记录）走 screen-overlay，不占 tabbar 席位。
 * v0.5：导入支持 .csv 与多工作表选择；导入结果改为应用内结果页（不再用 alert）。
 */
import { useEffect, useRef, useState } from 'react';
import type { AppData, RecordItem, Todo } from '../domain/types.ts';
import { emptyData, loadData, saveData, clearData, takeDailySnapshot } from '../storage/db.ts';
import { detect } from '../domain/import/detect.ts';
import { map } from '../domain/import/map.ts';
import { commit } from '../domain/import/commit.ts';
import type { ImportMapping } from '../domain/import/types.ts';
import { tablesFromBuffer, type SheetTable } from '../lib/xlsx.ts';
import { onNativeFile, getAppVersion, fetchLatestRelease, openExternal, updateNeeded, type UpdateInfo } from '../lib/nativeOpen.ts';
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
import { ImportResultSheet } from './components/ImportResultSheet.tsx';
import { AttendanceSheet } from './components/AttendanceSheet.tsx';
import { HomeworkSheet } from './components/HomeworkSheet.tsx';
import { myStudents } from '../domain/students.ts';
import { IconToday, IconStudents, IconPlus, IconTodos, IconMine, IconClose, IconImport, IconTalk, IconHeart, IconHomeVisit, IconMore, IconClock, IconHomework } from './icons.tsx';

type Tab = 'home' | 'students' | 'todos' | 'mine';

/** ＋ 动作盘的四个快捷记录类型 */
const QUICK_TYPES: [string, (props: { size?: number }) => JSX.Element][] = [
  ['沟通', IconTalk],
  ['谈心', IconHeart],
  ['家访', IconHomeVisit],
  ['其他', IconMore],
];

/**
 * 打开某张表的导入确认流程。放在模块层的原因：微信「用其他应用打开」的回调
 * 可能在首次渲染（数据未加载、提前 return）时就触发，那次渲染里组件局部函数
 * 尚未初始化（TDZ）——这里只用模块级纯函数和 setState，安全。
 */
function openImportForTable(
  fileName: string,
  sheet: SheetTable,
  setPendingImport: (p: PendingImport | null) => void,
  setSheetPick: (s: { fileName: string; sheets: SheetTable[] } | null) => void,
): void {
  const table = sheet.table;
  const sketch = detect(table);
  const mapping = map(table, sketch, [], {});
  setSheetPick(null);
  setPendingImport({
    fileName: `${fileName}（${sheet.name}）`,
    table,
    sketchHeaderRows: sketch.headerRows,
    mapping,
  });
}

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
  const [attOpen, setAttOpen] = useState(false);
  const [hwOpen, setHwOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [importResult, setImportResult] = useState<{ fileName: string; report: Awaited<ReturnType<typeof commit>>['report'] } | null>(null);
  const [sheetPick, setSheetPick] = useState<{ fileName: string; sheets: SheetTable[] } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  /** 检查更新：比较 GitHub 最新 Release 与本机 versionCode。启动时自动一次，「关于」卡可手动重查 */
  const checkUpdate = async (): Promise<'new' | 'latest' | 'error'> => {
    const app = await getAppVersion();
    if (!app) return 'error';
    const latest = await fetchLatestRelease();
    if (!latest) return 'error';
    if (updateNeeded(app.versionName, latest.versionName)) {
      setUpdateInfo(latest);
      return 'new';
    }
    setUpdateInfo(null);
    return 'latest';
  };
  useEffect(() => {
    void checkUpdate();
  }, []);

  useEffect(() => {
    loadData().then((d) => {
      const next = d ?? emptyData();
      setData(next);
      setLoaded(true);
      // 每天首次打开自动快照（失败不打扰使用，只是少了保险）
      takeDailySnapshot(next, new Date().toISOString().slice(0, 10)).catch(() => {});
    });
  }, []);

  // v0.7：微信/文件管理器「用其他应用打开」或分享成绩表进来 → 直接进导入确认流程
  useEffect(() => {
    void onNativeFile(
      ({ name, sheets }) => {
        if (sheets.length === 0) {
          alert('这份文件里没有找到有数据的表格。');
          return;
        }
        if (sheets.length === 1) {
          openImportForTable(name, sheets[0], setPendingImport, setSheetPick);
          return;
        }
        setSheetPick({ fileName: name, sheets });
      },
      (msg) => alert(`读表失败：${msg}`),
    );
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
      const { sheets } = await tablesFromBuffer(buf);
      if (sheets.length === 0) {
        alert('这份文件里没有找到有数据的表格。');
        return;
      }
      if (sheets.length === 1) {
        startImportFlow(file.name, sheets[0]);
        return;
      }
      // 多个工作表：让老师选（学校表格常把多个班/多次考试放进一个文件）
      setSheetPick({ fileName: file.name, sheets });
    } catch (e) {
      alert(`读表失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const startImportFlow = (fileName: string, sheet: SheetTable) => {
    openImportForTable(fileName, sheet, setPendingImport, setSheetPick);
  };
  const confirmImport = (mapping: ImportMapping) => {
    if (!pendingImport) return;
    const examLabels: Record<number, string> = {};
    for (const c of mapping.columns) {
      if (c.attempt) examLabels[c.attempt] = mapping.examLabels[c.attempt] ?? `第${c.attempt}次`;
    }
    const result = commit(data, pendingImport.table, mapping, { examLabels });
    void persist(result.data);
    setPendingImport(null);
    setImportResult({ fileName: pendingImport.fileName, report: result.report });
  };

  const scopeStudents = myStudents(data.students, data.settings.advisor);

  return (
    <div className="app">
      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xlsm,.csv"
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
            onGoImport={openImportPicker}
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
            updateInfo={updateInfo}
            onCheckUpdate={checkUpdate}
            onOpenExternal={openExternal}
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
          <ExamsScreen data={data} onOpenStudent={setDetailId} onBack={() => setExamsOpen(false)} onUpdate={persist} />
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

      {sheetPick && (
        <div className="sheet-mask" onClick={() => setSheetPick(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2 className="card-title">这份文件里有 {sheetPick.sheets.length} 个工作表</h2>
              <button className="icon-btn" aria-label="关闭" onClick={() => setSheetPick(null)}>
                <IconClose size={18} />
              </button>
            </div>
            <p className="muted">选一个要导入的（括号里是它的行数）。</p>
            <ul className="list student-pick-list">
              {sheetPick.sheets.map((s) => (
                <li key={s.name}>
                  <button className="row compact" onClick={() => startImportFlow(sheetPick.fileName, s)}>
                    <span className="row-main">
                      <span className="row-name">{s.name || '(未命名)'}</span>
                      <span className="row-sub">{s.table.length} 行</span>
                    </span>
                    <span className="row-side">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {plusOpen && (
        <div className="sheet-mask" onClick={() => setPlusOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2 className="card-title">添加</h2>
              <button className="icon-btn" aria-label="关闭" onClick={() => setPlusOpen(false)}>
                <IconClose size={18} />
              </button>
            </div>
            <div className="plus-grid">
              {QUICK_TYPES.map(([t, IconCmp]) => (
                <button
                  key={t}
                  className="quick-btn has-icon"
                  onClick={() => { setQuickType(t); setQuickOpen(true); setPlusOpen(false); }}
                >
                  <IconCmp size={20} />
                  <span>{t}</span>
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
              <button className="row compact" onClick={() => { setPlusOpen(false); setAttOpen(true); }}>
                <span className="row-main">
                  <span className="row-name row-with-icon"><IconClock size={18} /> 记考勤</span>
                  <span className="row-sub">迟到 / 请假 / 旷课，可连着记</span>
                </span>
                <span className="row-side">›</span>
              </button>
              <button className="row compact" onClick={() => { setPlusOpen(false); setHwOpen(true); }}>
                <span className="row-main">
                  <span className="row-name row-with-icon"><IconHomework size={18} /> 作业登记</span>
                  <span className="row-sub">全班平铺点一下，谁没交一眼清</span>
                </span>
                <span className="row-side">›</span>
              </button>
              <button className="row compact" onClick={openImportPicker}>
                <span className="row-main">
                  <span className="row-name row-with-icon"><IconImport size={18} /> 导入成绩表</span>
                  <span className="row-sub">Excel / CSV 文件，自动识别列</span>
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
            // 保存后弹层不关（QuickRecordSheet 自己显示「已记录」并可连记下一条）
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
      {attOpen && (
        <AttendanceSheet
          data={data}
          onClose={() => setAttOpen(false)}
          onSave={async (att) => {
            await persist({ ...data, attendance: [...data.attendance, att] });
          }}
        />
      )}
      {hwOpen && (
        <HomeworkSheet
          data={data}
          onClose={() => setHwOpen(false)}
          onSave={async (hw) => {
            await persist({ ...data, homework: [...data.homework, hw] });
            setHwOpen(false);
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
          onConfirm={confirmImport}
        />
      )}

      {importResult && (
        <ImportResultSheet
          fileName={importResult.fileName}
          report={importResult.report}
          onClose={() => setImportResult(null)}
        />
      )}

      {detailId == null && !weeklyOpen && !examsOpen && !recordsOpen && !pendingImport && (
        <nav className="tabbar">
          <button className={`tabbar-item${tab === 'home' ? ' active' : ''}`} onClick={() => setTab('home')}>
            <IconToday size={22} />
            <span>今日</span>
          </button>
          <button className={`tabbar-item${tab === 'students' ? ' active' : ''}`} onClick={() => setTab('students')}>
            <IconStudents size={22} />
            <span>学生</span>
          </button>
          <button className="tabbar-plus" aria-label="添加" onClick={() => setPlusOpen(true)}>
            <span className="plus-disc">
              <IconPlus size={24} />
            </span>
          </button>
          <button className={`tabbar-item${tab === 'todos' ? ' active' : ''}`} onClick={() => setTab('todos')}>
            <IconTodos size={22} />
            <span>待办</span>
          </button>
          <button className={`tabbar-item${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>
            <IconMine size={22} />
            <span>我的</span>
            {updateInfo && <span className="tab-dot" />}
          </button>
        </nav>
      )}
    </div>
  );
}
