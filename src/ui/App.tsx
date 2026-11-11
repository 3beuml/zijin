/**
 * 子衿 · 应用壳：底部三标签（学生 / 周手册 / 我的）。
 * 设计导航是五标签（今日|学生|成绩|待办|我的），今晚范围只做三个——
 * 待办、课表被明确砍掉（见 handoff-full「明确砍掉的」）。
 */
import { useEffect, useState } from 'react';
import type { AppData, RecordItem } from '../domain/types.ts';
import { emptyData, loadData, saveData, clearData } from '../storage/db.ts';
import { StudentsScreen } from './screens/StudentsScreen';
import { StudentDetail } from './screens/StudentDetail';
import { WeeklyScreen } from './screens/WeeklyScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Tab = 'students' | 'weekly' | 'mine';

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('students');
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    loadData().then((d) => {
      setData(d ?? emptyData());
      setLoaded(true);
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

  const addRecord = async (studentId: string, rec: Omit<RecordItem, 'id' | 'studentId' | 'createdAt'>) => {
    const id = `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
    await persist({
      ...data,
      records: [...data.records, { ...rec, id, studentId, createdAt: new Date().toISOString() }],
    });
  };

  const wipeAll = async () => {
    await clearData();
    setData(emptyData());
  };

  return (
    <div className="app">
      <main className="app-main">
        {tab === 'students' &&
          (detailId ? (
            <StudentDetail
              data={data}
              studentId={detailId}
              onBack={() => setDetailId(null)}
              onAddRecord={addRecord}
            />
          ) : (
            <StudentsScreen data={data} onOpenStudent={setDetailId} />
          ))}
        {tab === 'weekly' && <WeeklyScreen data={data} onOpenStudent={setDetailId} />}
        {tab === 'mine' && <SettingsScreen data={data} onImported={persist} onWipe={wipeAll} />}
      </main>

      {detailId == null && (
        <nav className="tabbar">
          <button className={`tabbar-item${tab === 'students' ? ' active' : ''}`} onClick={() => setTab('students')}>
            学生
          </button>
          <button className={`tabbar-item${tab === 'weekly' ? ' active' : ''}`} onClick={() => setTab('weekly')}>
            周手册
          </button>
          <button className={`tabbar-item${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>
            我的
          </button>
        </nav>
      )}
    </div>
  );
}
