/**
 * 导入管线 · 类型。四段：detect → map → (人工确认) → commit。
 * 本目录全部是纯函数：不碰文件、不碰 DOM、不 await。
 */

/** 单元格：exceljs 解析并归一化后的值（公式已取 result） */
export type Cell = string | number | null;

/** T1 规定的 role 取值，不许自创 */
export type SketchRole =
  | 'student.name'
  | 'student.class'
  | 'exam.total'
  | 'exam.rank'
  | 'subject.score'
  | 'subject.rank'
  | 'subject.rankPrev'
  | 'tier'
  | 'advisor'
  | 'derived'
  | 'unknown';

/** 列草图。index 一律 **1 起数**（与 T1 示例、模板 col 一致） */
export interface ColumnSketch {
  index: number;
  header: string; // 表头行合并后的文本
  role: SketchRole;
  subject?: string;
  attempt?: number; // 次别：1 = 上一次考试，2 = 本次
  poolScope?: 'grade' | 'class'; // 班名 → class，级名 → grade（提交时结合分层再定）
  confidence: number; // 0..1，低置信度在确认步骤高亮
}

export interface SubjectGroup {
  subject: string;
  columns: {
    tier?: number;
    rankPrev?: number;
    score?: number;
    rank?: number;
  };
}

export interface DerivedColumn {
  index: number;
  header: string;
  reason: string;
}

export interface StructureSketch {
  headerRows: number; // 数据区之前的行数（含标题行、多级表头）
  titleText: string | null; // 标题行文本（如「……期中考试成绩表」）
  columns: ColumnSketch[]; // 覆盖全部列，无遗漏
  subjectGroups: SubjectGroup[];
  derivedColumns: DerivedColumn[];
  warnings: string[];
  dataStartRow: number; // 1 起
  dataEndRow: number; // 1 起（含），已剔除末尾合计/平均行
}

/** 映射后的一列（确认步骤的产物，人可改） */
export interface MappingColumn {
  index: number;
  header: string;
  role: SketchRole;
  subject?: string;
  attempt?: number;
  poolScope?: 'grade' | 'class';
  confidence: number;
  source: 'sketch' | 'template' | 'fallback';
}

export interface ImportMapping {
  headerRows: number;
  dataStartRow: number;
  dataEndRow: number;
  columns: MappingColumn[];
  examLabels: Record<number, string>; // attempt → 考试名（如 {2:'期中'}）
  warnings: string[];
  matchedTemplate: string | null;
}

/** 模板：列名→语义的映射，不含任何学生数据（design-data §模板） */
export interface ImportTemplate {
  name: string;
  match: { columns: string[]; headerRows: number };
  mapping: {
    col: number;
    role: SketchRole;
    subject?: string;
    attempt?: number;
    poolScope?: 'grade' | 'class';
  }[];
}

export interface CommitReport {
  warnings: string[];
  studentsCreated: number;
  studentsMatched: number;
  examsCreated: number;
  scoresWritten: number;
  scoresUpdated: number; // 同键替换/合并的行数（重导同一次考试不再翻倍）
  droppedRows: { row: number; reason: string }[];
}

export interface CommitOptions {
  classId?: string; // 表里没有班级列时用
  examLabels?: Record<number, string>;
  examDates?: Record<number, string>; // attempt → 'YYYY-MM-DD'
  now?: string; // createdAt 用（测试可固定）
}
