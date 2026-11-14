/** 学生列表：分包视图优先（在 33 个孩子里看见那 16 个），行 56px，右侧「本周状态」 */
import { useMemo, useState } from 'react';
import type { AppData } from '../../domain/types.ts';
import { weeklySummary } from '../../domain/weekly.ts';
import { filterStudents, sortByRecentRecord } from '../../domain/students.ts';
import { todayStr } from '../util.ts';

export function StudentsScreen({
  data,
  onOpenStudent,
}: {
  data: AppData;
  onOpenStudent: (id: string) => void;
}) {
  const [scope, setScope] = useState<'mine' | 'all'>(data.settings.advisor ? 'mine' : 'all');
  const [q, setQ] = useState('');
  const [onlyUncovered, setOnlyUncovered] = useState(false);
  const [gender, setGender] = useState<'' | '男' | '女'>('');
  const [dorm, setDorm] = useState('');
  const [tag, setTag] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'recent'>('default');
  const today = todayStr();

  const week = useMemo(() => weeklySummary(data.students, data.records, today), [data, today]);
  const contacted = new Set(week.countByStudent.keys());

  const filtered = useMemo(
    () =>
      filterStudents(data.students, {
        scope,
        advisor: data.settings.advisor,
        keyword: q,
        onlyUncovered,
        contactedThisWeek: contacted,
        gender,
        dorm,
        tag,
      }),
    [data.students, data.settings.advisor, scope, q, onlyUncovered, gender, dorm, tag, today],
  );
  const students = useMemo(
    () => (sortBy === 'recent' ? sortByRecentRecord(filtered, data.records) : filtered),
    [filtered, data.records, sortBy],
  );

  const mineCount = data.settings.advisor
    ? data.students.filter((s) => s.advisor === data.settings.advisor).length
    : 0;

  // 筛选选项：宿舍/标签来自库里已有的值（没填过就不显示这个筛选项）
  const dorms = [...new Set(data.students.map((s) => s.dorm).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b, 'zh'));
  const tags = [...new Set(data.students.flatMap((s) => s.tags ?? []))].sort((a, b) => a.localeCompare(b, 'zh'));

  return (
    <div className="page">
      <h1 className="page-title">学生</h1>
      <div className="summary-line">
        {scope === 'mine' && data.settings.advisor
          ? `我的分包 ${mineCount} 人 · 本周已沟通 ${data.students.filter((s) => s.advisor === data.settings.advisor && contacted.has(s.id)).length}/${mineCount}`
          : `${data.students.length} 人 · 本周已沟通 ${week.covered}/${week.total}`}
      </div>

      {data.settings.advisor ? (
        <div className="scope-switch" role="tablist" aria-label="范围">
          <button
            className={`scope-btn${scope === 'mine' ? ' active' : ''}`}
            onClick={() => setScope('mine')}
          >
            我的分包 {mineCount}
          </button>
          <button
            className={`scope-btn${scope === 'all' ? ' active' : ''}`}
            onClick={() => setScope('all')}
          >
            全班 {data.students.length}
          </button>
          <button
            className={`scope-btn${onlyUncovered ? ' active warn' : ''}`}
            onClick={() => setOnlyUncovered((v) => !v)}
          >
            本周未联系
          </button>
        </div>
      ) : data.students.length > 0 ? (
        <div className="scope-hint">
          还没设置「我是哪位导师」——到「我的 → 分包」设置后，这里默认只看你的学生。
        </div>
      ) : null}

      <input
        className="search"
        type="search"
        placeholder="搜姓名 / 导师"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {data.students.length > 0 && (
        <div className="filter-row">
          <button className={`chip${gender === '' ? ' active' : ''}`} onClick={() => setGender('')}>
            全部
          </button>
          <button className={`chip${gender === '男' ? ' active' : ''}`} onClick={() => setGender(gender === '男' ? '' : '男')}>
            男
          </button>
          <button className={`chip${gender === '女' ? ' active' : ''}`} onClick={() => setGender(gender === '女' ? '' : '女')}>
            女
          </button>
          <button
            className={`chip${sortBy === 'recent' ? ' active' : ''}`}
            onClick={() => setSortBy(sortBy === 'recent' ? 'default' : 'recent')}
            title="按最近一次沟通记录时间排序"
          >
            按最近沟通
          </button>
          {dorms.length > 0 && (
            <select className="filter-select" value={dorm} onChange={(e) => setDorm(e.target.value)} aria-label="按宿舍筛选">
              <option value="">宿舍不限</option>
              {dorms.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          {tags.length > 0 && (
            <select className="filter-select" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="按标签筛选">
              <option value="">标签不限</option>
              {tags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {students.length === 0 ? (
        <div className="empty-hint">
          {data.students.length === 0 ? (
            <>
              还没有学生数据。
              <br />
              到「我的」导入一份成绩表开始。
            </>
          ) : (
            '没有符合条件的学生。'
          )}
        </div>
      ) : (
        <ul className="list">
          {students.map((s) => {
            const count = week.countByStudent.get(s.id) ?? 0;
            return (
              <li key={s.id}>
                <button className="row" onClick={() => onOpenStudent(s.id)}>
                  <span className="row-main">
                    <span className="row-name">
                      {s.name}
                      {data.settings.advisor && s.advisor === data.settings.advisor ? (
                        <span className="tag mine-tag">分包</span>
                      ) : null}
                    </span>
                    <span className="row-sub">
                      {[s.dorm, (s.tags ?? []).join('、')].filter(Boolean).join(' · ') ||
                        (s.advisor ? `导师 ${s.advisor}` : '未分包')}
                    </span>
                  </span>
                  <span className={`row-side ${count > 0 ? 'ok' : 'warn'}`}>
                    {count > 0 ? `本周 ${count} 次` : '本周未联系'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
