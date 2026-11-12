/**
 * 子衿 · 应用壳：底部五标签（今日 / 学生 / 待办 / 周手册 / 我的）。
 * design-ui 的导航上限是 5；成绩并入学生详情，课表暂不做。
 */
import { useEffect, useState } from 'react';
import type { AppData, RecordItem, Todo } from '../domain/types.ts';
import { emptyData, loadData, saveData, clearData, takeDailySnapshot } from '../storage/db.ts';
import { HomeScreen } from './screens/HomeScreen';
import { StudentsScreen } from './screens/StudentsScreen';
import { StudentDetail } from './screens/StudentDetail';
import { RecordsScreen } from './screens/RecordsScreen';
import { WeeklyScreen } from './screens/WeeklyScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TodosScreen } from './screens/TodosScreen';
import { SearchOverlay } from './components/SearchOverlay.tsx';

type Tab = 'home' | 'students' | 'records' | 'todos' | 'mine';

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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

  return (
    <div className="app">
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
        {tab === 'records' && <RecordsScreen data={data} onUpdate={persist} onOpenStudent={setDetailId} />}
        {tab === 'todos' && <TodosScreen data={data} onUpdate={persist} />}
        {tab === 'mine' && (
          <SettingsScreen
            data={data}
            onImported={persist}
            onWipe={wipeAll}
            onGoWeekly={() => setWeeklyOpen(true)}
          />
        )}
      </main>

      {weeklyOpen && (
        <WeeklyScreen data={data} onOpenStudent={setDetailId} onBack={() => setWeeklyOpen(false)} />
      )}

      {searchOpen && (
        <SearchOverlay data={data} onClose={() => setSearchOpen(false)} onOpenStudent={setDetailId} />
      )}

      {detailId == null && !weeklyOpen && (
        <nav className="tabbar">
          <button className={`tabbar-item${tab === 'home' ? ' active' : ''}`} onClick={() => setTab('home')}>
            今日
          </button>
          <button className={`tabbar-item${tab === 'students' ? ' active' : ''}`} onClick={() => setTab('students')}>
            学生
          </button>
          <button className={`tabbar-item${tab === 'records' ? ' active' : ''}`} onClick={() => setTab('records')}>
            记录
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
