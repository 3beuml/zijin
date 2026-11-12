/** 全局搜索浮层：学生 / 记录 / 待办 一次搜完（teacher 需求 §5.8） */
import { useMemo, useState } from 'react';
import type { AppData } from '../../domain/types.ts';
import { searchAll } from '../../domain/search.ts';
import { shortDate } from '../util.ts';

export function SearchOverlay({
  data,
  onClose,
  onOpenStudent,
}: {
  data: AppData;
  onClose: () => void;
  onOpenStudent: (id: string) => void;
}) {
  const [kw, setKw] = useState('');
  const results = useMemo(() => searchAll(data, kw), [data, kw]);
  const nameOf = (id: string) => data.students.find((s) => s.id === id)?.name ?? '?';

  return (
    <div className="search-overlay">
      <div className="search-bar">
        <input
          type="search"
          placeholder="搜学生 / 记录内容 / 待办"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          autoFocus
          aria-label="全局搜索"
        />
        <button className="btn" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="search-results">
        {kw.trim() !== '' && results.students.length === 0 && results.records.length === 0 && results.todos.length === 0 && (
          <p className="muted">没有匹配结果。</p>
        )}

        {results.students.length > 0 && (
          <>
            <h2 className="section-title">学生（{results.students.length}）</h2>
            <ul className="list">
              {results.students.slice(0, 20).map((s) => (
                <li key={s.id}>
                  <button
                    className="row compact"
                    onClick={() => {
                      onClose();
                      onOpenStudent(s.id);
                    }}
                  >
                    <span className="row-main">
                      <span className="row-name">{s.name}</span>
                      <span className="row-sub">
                        {[s.advisor && `导师 ${s.advisor}`, s.dorm, (s.tags ?? []).join('、')]
                          .filter(Boolean)
                          .join(' · ') || '无附加信息'}
                      </span>
                    </span>
                    <span className="row-side">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {results.records.length > 0 && (
          <>
            <h2 className="section-title">记录（{results.records.length}）</h2>
            <ul className="timeline">
              {results.records.map((r) => (
                <li key={r.id}>
                  <span className="tl-date">{shortDate(r.date)}</span>
                  <span className="tag">{r.type}</span>
                  <span
                    className="tl-content"
                    onClick={() => {
                      onClose();
                      onOpenStudent(r.studentId);
                    }}
                    role="button"
                  >
                    <b>{nameOf(r.studentId)}</b> · {r.content}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {results.todos.length > 0 && (
          <>
            <h2 className="section-title">待办（{results.todos.length}）</h2>
            <ul className="plain-list">
              {results.todos.map((t) => (
                <li key={t.id}>
                  {t.status === 'done' ? '✓ ' : ''}
                  {t.due} · {t.title}
                  {t.studentId ? `（${nameOf(t.studentId)}）` : ''}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
