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
    settings: { advisor: '' },
  };
}

/** 旧备份 / 旧库兼容：补齐 v0.2 新增的 todos 与 settings */
export function normalizeData(raw: Partial<AppData> | null): AppData {
  const base = emptyData();
  if (!raw) return base;
  return {
    version: 1,
    students: Array.isArray(raw.students) ? raw.students : base.students,
    exams: Array.isArray(raw.exams) ? raw.exams : base.exams,
    scores: Array.isArray(raw.scores) ? raw.scores : base.scores,
    records: Array.isArray(raw.records) ? raw.records : base.records,
    todos: Array.isArray(raw.todos) ? raw.todos : base.todos,
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
