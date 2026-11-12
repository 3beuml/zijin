/**
 * 子衿 · 领域类型（公开契约）
 *
 * 数据契约见 docs/handoff-full.md：
 *   { version, students, exams, scores, records }
 * 改这里之前先问人 —— accept.mjs 只认这个形状。
 */

/** 分层：1 层 / 2 层；null = 该池不分层 */
export type Tier = '1' | '2';

/** 池的范围：全年级 / 层内 / 班内（班内仅用于表里没有名次、按导入范围现算的情形） */
export type PoolScope = 'grade' | 'tier' | 'class';

/**
 * 排名池 —— 名次只在同一个池内可比。
 * 展示名次必须带池标签（「二层内第 5 名」），不许裸写「第 5 名」。
 */
export interface RankPool {
  subject: string;
  tier: Tier | null;
  scope: PoolScope;
}

export interface Student {
  id: string;
  name: string;
  classId: string;
  advisor: string; // 导师（分包），导入时必填校验
  /** 以下为档案可编辑字段（v0.3）。不存电话/住址等敏感信息——遵守隐私契约 */
  gender?: '男' | '女';
  dorm?: string; // 宿舍（楼/房），自由文本
  note?: string; // 备注（家庭情况概要、学业规划等，老师自己填）
  tags?: string[]; // 标签（如「临界生」「手机管控」）
}

/** 考试次别：label + date + order（order 决定时间线上的先后） */
export interface Exam {
  id: string;
  label: string;
  date: string; // 'YYYY-MM-DD'，表里没有日期列时为 ''
  order: number; // 1 = 上一次，2 = 本次，依此类推
}

/**
 * 一条科目分数。总分也是一条：subject = '总分'。
 * raw 为 null 表示缺考 / 文本分数；rank 为 null 表示表里没有名次。
 */
export interface Score {
  studentId: string;
  examId: string;
  subject: string;
  raw: number | null;
  rank: number | null;
  pool: RankPool; // 必填：没有池的名次一律不合格
}

/** 沟通 / 谈心 / 日常记录（时间线） */
export interface RecordItem {
  id: string;
  studentId: string;
  date: string; // 'YYYY-MM-DD'
  type: string; // 沟通 | 谈心 | 家访 | …
  content: string;
  createdAt: string; // ISO 时间戳，用于排序
}

/** 待办（v0.2，参考 teacher 的 Todo；逾期置顶、完成后可撤销） */
export interface Todo {
  id: string;
  title: string;
  type: string; // 家校 | 学生 | 教学 | 班级 | 行政
  priority: 'high' | 'mid' | 'low';
  due: string; // 'YYYY-MM-DD'
  status: 'open' | 'done';
  doneAt?: string; // ISO，完成后可撤销
  studentId?: string; // 关联学生（跟进待办）
  note?: string;
  createdAt: string; // ISO
}

/** 应用设置（本地，不进外部验收契约的检查范围） */
export interface Settings {
  /** 「我是哪位导师」——分包视图的基准；空 = 未设置 */
  advisor: string;
}

/** 全库形状（存储层 / 导出契约共用） */
export interface AppData {
  version: 1;
  students: Student[];
  exams: Exam[];
  scores: Score[];
  records: RecordItem[];
  todos: Todo[];
  settings: Settings;
}

export const TOTAL_SUBJECT = '总分';

/** 参与总分核算的四个科目（accept.mjs 的 SUBJECTS_FOR_TOTAL） */
export const CORE_SUBJECTS = ['语文', '数学', '英语', '物理'] as const;
