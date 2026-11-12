/**
 * 全局搜索（teacher 需求 §5.8：「上次跟谁家长聊过手机的事是哪天」）。
 * 一搜三处：学生（姓名/导师/标签/备注/宿舍）、记录（内容/类型）、待办（标题/备注）。
 */
import type { AppData } from './types.ts';

export interface SearchResults {
  students: AppData['students'];
  records: AppData['records']; // 按时间倒序
  todos: AppData['todos']; // 未完成在前
}

function hit(text: string | undefined, kw: string): boolean {
  return text != null && text.includes(kw);
}

export function searchAll(data: AppData, keyword: string): SearchResults {
  const kw = keyword.trim();
  if (!kw) return { students: [], records: [], todos: [] };
  const students = data.students.filter(
    (s) =>
      hit(s.name, kw) ||
      hit(s.advisor, kw) ||
      hit(s.dorm, kw) ||
      hit(s.note, kw) ||
      (s.tags ?? []).some((t) => hit(t, kw)),
  );
  const studentIds = new Set(students.map((s) => s.id));
  const records = data.records
    .filter((r) => hit(r.content, kw) || hit(r.type, kw) || studentIds.has(r.studentId))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 50);
  const todos = data.todos
    .filter((t) => hit(t.title, kw) || hit(t.note, kw))
    .sort((a, b) => (a.status === b.status ? a.due.localeCompare(b.due) : a.status === 'open' ? -1 : 1))
    .slice(0, 20);
  return { students, records, todos };
}
