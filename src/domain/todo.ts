/**
 * 待办：今日/本周/逾期视图、跟进待办生成。
 * 约定（参考 teacher 的状态规则）：逾期不自动改日期，标红置顶；
 * 完成不删除（done + doneAt），可撤销。
 */
import type { Todo } from './types.ts';

/** 是否逾期：未完成且截止日早于今天 */
export function isOverdue(t: Todo, today: string): boolean {
  return t.status === 'open' && t.due < today;
}

export interface TodoViews {
  overdue: Todo[]; // 逾期（置顶，按截止升序）
  today: Todo[]; // 今日到期（含已完成的今日项，完成态由 UI 呈现）
  later: Todo[]; // 今日之后（本周及以后，未完成）
  done: Todo[]; // 已完成（按完成时间倒序）
}

/** 待办的四个视图（teacher 的「今日/本周/全部/已完成」收敛成一组） */
export function todoViews(todos: Todo[], today: string): TodoViews {
  const overdue: Todo[] = [];
  const today_: Todo[] = [];
  const later: Todo[] = [];
  const done: Todo[] = [];
  for (const t of todos) {
    if (t.status === 'done') {
      done.push(t);
      continue;
    }
    if (t.due < today) overdue.push(t);
    else if (t.due === today) today_.push(t);
    else later.push(t);
  }
  const byDue = (a: Todo, b: Todo) => a.due.localeCompare(b.due) || a.createdAt.localeCompare(b.createdAt);
  const byPriority = (t: Todo): number => (t.priority === 'high' ? 0 : t.priority === 'mid' ? 1 : 2);
  overdue.sort((a, b) => byDue(a, b) || byPriority(a) - byPriority(b));
  today_.sort((a, b) => byPriority(a) - byPriority(b) || byDue(a, b));
  later.sort(byDue);
  done.sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  return { overdue, today: today_, later, done };
}

/** [start, end] 区间内到期的未完成待办（近期重要工作 / 下周重点） */
export function todosDueBetween(todos: Todo[], start: string, end: string): Todo[] {
  return todos
    .filter((t) => t.status === 'open' && t.due >= start && t.due <= end)
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** 下周重点：下一周到期的未完成待办（周手册用） */
export function nextWeekTodos(todos: Todo[], weekEnd: string): Todo[] {
  // weekEnd 是本周周日；下周 = +1 .. +7 天
  const [y, m, d] = weekEnd.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) + 86400000);
  const end = new Date(Date.UTC(y, m - 1, d) + 7 * 86400000);
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);
  return todosDueBetween(todos, iso(start), iso(end));
}

/** 某学生的未完成待办（学生详情用） */
export function openTodosOf(todos: Todo[], studentId: string): Todo[] {
  return todos
    .filter((t) => t.studentId === studentId && t.status === 'open')
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** 切换完成态（勾选 / 撤销） */
export function toggleTodo(t: Todo, nowIso: string): Todo {
  return t.status === 'open'
    ? { ...t, status: 'done' as const, doneAt: nowIso }
    : { ...t, status: 'open' as const, doneAt: undefined };
}

/** 从一条学生记录生成跟进待办（「下周三前回访」这种事不靠脑子记） */
export function followUpTodo(input: {
  id: string;
  studentId: string;
  title: string;
  due: string;
  nowIso: string;
}): Todo {
  return {
    id: input.id,
    title: input.title,
    type: '家校',
    priority: 'mid',
    due: input.due,
    status: 'open',
    studentId: input.studentId,
    createdAt: input.nowIso,
  };
}
