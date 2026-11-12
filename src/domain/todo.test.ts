import { describe, expect, it } from 'vitest';
import {
  followUpTodo,
  isOverdue,
  nextWeekTodos,
  openTodosOf,
  todoViews,
  todosDueBetween,
  toggleTodo,
} from './todo';
import type { Todo } from './types';

function t(partial: Partial<Todo> & { id: string; due: string }): Todo {
  return {
    title: `待办${partial.id}`,
    type: '家校',
    priority: 'mid',
    status: 'open',
    createdAt: '2026-11-09T08:00:00',
    ...partial,
  };
}

describe('todoViews', () => {
  const today = '2026-11-12'; // 周四
  const todos: Todo[] = [
    t({ id: 'a', due: '2026-11-10' }), // 逾期
    t({ id: 'b', due: '2026-11-09', priority: 'high' }), // 逾期（高优先级在前）
    t({ id: 'c', due: '2026-11-12' }), // 今日
    t({ id: 'd', due: '2026-11-14' }), // 本周后几天
    t({ id: 'e', due: '2026-11-12', status: 'done' }), // 完成的今日项
  ];
  it('分组正确：逾期置顶、今日、之后、已完成', () => {
    const v = todoViews(todos, today);
    expect(v.overdue.map((x) => x.id)).toEqual(['b', 'a']);
    expect(v.today.map((x) => x.id)).toEqual(['c']);
    expect(v.later.map((x) => x.id)).toEqual(['d']);
    expect(v.done.map((x) => x.id)).toEqual(['e']);
  });
  it('空输入', () => {
    const v = todoViews([], today);
    expect(v.overdue).toHaveLength(0);
    expect(v.done).toHaveLength(0);
  });
});

describe('isOverdue / todosDueBetween / nextWeekTodos', () => {
  it('逾期 = 未完成且截止早于今天', () => {
    const today = '2026-11-12';
    expect(isOverdue(t({ id: 'x', due: '2026-11-11' }), today)).toBe(true);
    expect(isOverdue(t({ id: 'x', due: '2026-11-12' }), today)).toBe(false);
    expect(isOverdue(t({ id: 'x', due: '2026-11-11', status: 'done' }), today)).toBe(false);
  });
  it('区间内到期（近期重要工作）', () => {
    const todos = [t({ id: 'a', due: '2026-11-13' }), t({ id: 'b', due: '2026-11-20' }), t({ id: 'c', due: '2026-11-13', status: 'done' })];
    expect(todosDueBetween(todos, '2026-11-12', '2026-11-15').map((x) => x.id)).toEqual(['a']);
  });
  it('下周重点：本周日之后 1..7 天', () => {
    const todos = [
      t({ id: 'a', due: '2026-11-15' }), // 本周日
      t({ id: 'b', due: '2026-11-16' }), // 下周一
      t({ id: 'c', due: '2026-11-22' }), // 下周日
      t({ id: 'd', due: '2026-11-23' }), // 下下周一
    ];
    expect(nextWeekTodos(todos, '2026-11-15').map((x) => x.id)).toEqual(['b', 'c']);
  });
});

describe('openTodosOf / toggleTodo / followUpTodo', () => {
  it('某学生的未完成待办按截止升序', () => {
    const todos = [
      t({ id: 'a', due: '2026-11-20', studentId: 's1' }),
      t({ id: 'b', due: '2026-11-13', studentId: 's1' }),
      t({ id: 'c', due: '2026-11-13', studentId: 's2' }),
      t({ id: 'd', due: '2026-11-12', studentId: 's1', status: 'done' }),
    ];
    expect(openTodosOf(todos, 's1').map((x) => x.id)).toEqual(['b', 'a']);
  });
  it('完成↔撤销', () => {
    const now = '2026-11-12T09:00:00';
    const done = toggleTodo(t({ id: 'a', due: '2026-11-12' }), now);
    expect(done.status).toBe('done');
    expect(done.doneAt).toBe(now);
    expect(toggleTodo(done, now).status).toBe('open');
  });
  it('跟进待办：关联学生、家校类型', () => {
    const todo = followUpTodo({
      id: 'n1',
      studentId: 's1',
      title: '下周三前回访家长',
      due: '2026-11-18',
      nowIso: '2026-11-12T09:00:00',
    });
    expect(todo.studentId).toBe('s1');
    expect(todo.type).toBe('家校');
    expect(todo.status).toBe('open');
    expect(todo.priority).toBe('mid');
  });
});
