/**
 * 存储层：IndexedDB（design-data §四：不用 localStorage，5MB 撑不住）。
 * v0.1 用单键整库（'kv' store 的 'data' 键存整个 AppData）：
 * 33 学生 × 多次考试 × 记录的量级远够，且导出/备份/整体替换都简单。
 * 本模块不 import domain 业务逻辑，只搬 JSON。
 */
import type { AppData } from '../domain/types.ts';

const DB_NAME = 'zijin';
const DB_VERSION = 1;
const STORE = 'kv';
const KEY_DATA = 'data';

export function emptyData(): AppData {
  return {
    version: 1,
    students: [],
    exams: [],
    scores: [],
    records: [],
    todos: [],
    attendance: [],
    homework: [],
    settings: { advisor: '' },
  };
}

/** 考勤/作业的合法取值（db 层自持一份，不 import domain 业务逻辑） */
const ATT_TYPES = ['迟到', '早退', '病假', '事假', '旷课', '离校'];
const HW_STATUSES = ['交', '迟交', '未交', '补交', '免交'];

/**
 * 旧备份 / 旧库兼容：补齐 v0.2 新增的 todos 与 settings、v0.6 新增的 attendance 与 homework。
 * v0.5 起逐项校验：备份文件可能是手工编辑过的，坏行（缺 id/姓名、缺池）直接丢弃，
 * 不让脏数据进库把界面搞崩。
 */
export function normalizeData(raw: Partial<AppData> | null): AppData {
  const base = emptyData();
  if (!raw) return base;
  const students = (Array.isArray(raw.students) ? raw.students : []).filter(
    (s): s is AppData['students'][number] =>
      !!s && typeof s === 'object' && typeof s.id === 'string' && typeof s.name === 'string' && s.name.trim() !== '',
  );
  const exams = (Array.isArray(raw.exams) ? raw.exams : []).filter(
    (e): e is AppData['exams'][number] => !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.label === 'string',
  );
  const examIds = new Set(exams.map((e) => e.id));
  const studentIds = new Set(students.map((s) => s.id));
  const scores = (Array.isArray(raw.scores) ? raw.scores : []).filter(
    (s): s is AppData['scores'][number] =>
      !!s && typeof s === 'object' &&
      typeof s.studentId === 'string' && typeof s.examId === 'string' &&
      typeof s.subject === 'string' &&
      studentIds.has(s.studentId) && examIds.has(s.examId) &&
      !!s.pool && typeof s.pool === 'object' && typeof s.pool.scope === 'string',
  );
  const records = (Array.isArray(raw.records) ? raw.records : []).filter(
    (r): r is AppData['records'][number] =>
      !!r && typeof r === 'object' && typeof r.id === 'string' &&
      typeof r.studentId === 'string' && studentIds.has(r.studentId) &&
      typeof r.content === 'string',
  );
  const todos = (Array.isArray(raw.todos) ? raw.todos : []).filter(
    (t): t is AppData['todos'][number] =>
      !!t && typeof t === 'object' && typeof t.id === 'string' && typeof t.title === 'string',
  );
  const attendance = (Array.isArray(raw.attendance) ? raw.attendance : []).filter(
    (a): a is AppData['attendance'][number] =>
      !!a && typeof a === 'object' && typeof a.id === 'string' &&
      typeof a.studentId === 'string' && studentIds.has(a.studentId) &&
      typeof a.date === 'string' && ATT_TYPES.includes(a.type),
  );
  const homework = (Array.isArray(raw.homework) ? raw.homework : []).filter(
    (h): h is AppData['homework'][number] =>
      !!h && typeof h === 'object' && typeof h.id === 'string' && typeof h.date === 'string' &&
      Array.isArray(h.records),
  ).map((h) => ({
    ...h,
    records: h.records.filter(
      (r): r is AppData['homework'][number]['records'][number] =>
        !!r && typeof r === 'object' && typeof r.studentId === 'string' &&
        studentIds.has(r.studentId) && HW_STATUSES.includes(r.status),
    ),
  }));
  return {
    version: 1,
    students,
    exams,
    scores,
    records,
    todos,
    attendance,
    homework,
    settings: raw.settings && typeof raw.settings === 'object'
      ? { advisor: typeof raw.settings.advisor === 'string' ? raw.settings.advisor : '' }
      : base.settings,
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('此环境没有 IndexedDB（IndexedDB unavailable）'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打不开'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 事务失败'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 事务中止'));
  });
}

export async function loadData(): Promise<AppData | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY_DATA);
      req.onsuccess = () => {
        const raw = (req.result as AppData | undefined) ?? null;
        resolve(raw ? normalizeData(raw) : null);
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB 读失败'));
    });
  } finally {
    db.close();
  }
}

export async function saveData(data: AppData): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(data, KEY_DATA);
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** 危险操作：清库。界面层必须二次确认后才许调。 */
export async function clearData(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await txDone(tx);
  } finally {
    db.close();
  }
}

/* ---- 每日快照（v0.3，参考 teacher §8.4：保留最近 7 天）---- */

const SNAP_PREFIX = 'snap-';
const SNAP_KEEP = 7;

export interface Snapshot {
  date: string; // 'YYYY-MM-DD'，即快照键
  data: AppData;
}

/** 每天首次打开时拍一次快照；当天已有则跳过；超过 7 份删最旧的 */
export async function takeDailySnapshot(data: AppData, today: string): Promise<boolean> {
  const db = await openDb();
  try {
    const existing = await new Promise<AppData | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(SNAP_PREFIX + today);
      req.onsuccess = () => resolve(req.result as AppData | undefined);
      req.onerror = () => reject(req.error ?? new Error('快照读取失败'));
    });
    if (existing) return false; // 今天已经拍过

    const all = await new Promise<{ key: string; data: AppData }[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const out: { key: string; data: AppData }[] = [];
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          const key = String(cur.key);
          if (key.startsWith(SNAP_PREFIX)) out.push({ key, data: cur.value as AppData });
          cur.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = () => reject(req.error ?? new Error('快照遍历失败'));
    });

    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.put(data, SNAP_PREFIX + today);
    const stale = all
      .map((s) => s.key.slice(SNAP_PREFIX.length))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort((a, b) => b.localeCompare(a))
      .slice(SNAP_KEEP - 1); // 旧的（保留 7 份含今天）
    for (const d of stale) store.delete(SNAP_PREFIX + d);
    await txDone(tx);
    return true;
  } finally {
    db.close();
  }
}

/** 快照列表（新在前） */
export async function listSnapshots(): Promise<Snapshot[]> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const out: Snapshot[] = [];
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          const key = String(cur.key);
          if (key.startsWith(SNAP_PREFIX)) out.push({ date: key.slice(SNAP_PREFIX.length), data: cur.value as AppData });
          cur.continue();
        } else {
          resolve(out.sort((a, b) => b.date.localeCompare(a.date)));
        }
      };
      req.onerror = () => reject(req.error ?? new Error('快照遍历失败'));
    });
  } finally {
    db.close();
  }
}
