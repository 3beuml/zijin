/**
 * 原生文件打开桥（v0.7）：微信 / 文件管理器「用其他应用打开」/ 分享 → 子衿直接进导入流程。
 * 对应安卓侧 OpenFilePlugin（android/…/OpenFilePlugin.java）：
 * - 冷启动（点文件图标启动）→ getInitialFile()
 * - 热启动（App 已开着又收到文件）→ fileOpened 事件
 * 浏览器（dev）里 isNativePlatform() 为 false，整段静默跳过——不影响 npm run dev。
 */
import { registerPlugin, Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { tablesFromBuffer, type SheetTable } from './xlsx.ts';
import { isNewerVersion } from './version.ts';

interface OpenFileNative {
  /** 冷启动文件；读不出来但有打开意图时返回 { error } */
  getInitialFile(): Promise<{ name?: string; base64?: string; error?: string } | undefined>;
  /** 应用自身版本（更新检查用） */
  getAppVersion(): Promise<{ versionName?: string; versionCode?: number } | undefined>;
  /** 用系统浏览器打开外部链接 */
  openUrl(options: { url: string }): Promise<void>;
  addListener(
    eventName: 'fileOpened',
    cb: (file: { name?: string; base64?: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'openFileError',
    cb: (err: { message?: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const OpenFile = registerPlugin<OpenFileNative>('OpenFile');

const REPO_RELEASES = 'https://github.com/3beuml/zijin/releases';
const LATEST_API = 'https://api.github.com/repos/3beuml/zijin/releases/latest';

export interface AppVersion {
  versionName: string;
  versionCode: number;
}
export interface UpdateInfo {
  versionName: string; // Release 标签，如 'v1.0.4'
  url: string; // Releases 页
}

export async function getAppVersion(): Promise<AppVersion | undefined> {
  if (!nativeOpenAvailable()) return undefined;
  try {
    const v = await OpenFile.getAppVersion();
    if (!v || typeof v.versionCode !== 'number') return undefined;
    return { versionName: v.versionName ?? '', versionCode: v.versionCode };
  } catch {
    return undefined;
  }
}

export async function openExternal(url: string): Promise<void> {
  if (!nativeOpenAvailable()) {
    window.open(url, '_blank');
    return;
  }
  await OpenFile.openUrl({ url });
}

/** 向 GitHub 查询最新 Release；网络不可用或解析失败返回 undefined */
export async function fetchLatestRelease(): Promise<UpdateInfo | undefined> {
  if (!nativeOpenAvailable()) return undefined;
  try {
    const resp = await fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!resp.ok) return undefined;
    const j = (await resp.json()) as { tag_name?: string; html_url?: string };
    const tag = String(j.tag_name ?? '').trim();
    if (!tag) return undefined;
    return { versionName: tag, url: j.html_url ?? REPO_RELEASES };
  } catch {
    return undefined;
  }
}

/** 应用是否需要更新：latest 的版本号比当前新 */
export function updateNeeded(currentVersionName: string, latestTag: string): boolean {
  return isNewerVersion(currentVersionName, latestTag);
}

export interface OpenedNativeFile {
  name: string;
  sheets: SheetTable[];
}

function decodeBase64(base64: string): ArrayBuffer {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** 原生层是否可用（安卓壳内为 true） */
export function nativeOpenAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/** 订阅外部打开的文件；冷启动的那份也会在这里回调出来 */
export async function onNativeFile(
  cb: (file: OpenedNativeFile) => void,
  onError: (message: string) => void,
): Promise<void> {
  if (!nativeOpenAvailable()) return;
  const handle = (f: { name?: string; base64?: string } | undefined): void => {
    if (!f?.base64) return;
    void parseNativeFile(f)
      .then((parsed) => cb(parsed))
      .catch((e) => onError(e instanceof Error ? e.message : String(e)));
  };
  await OpenFile.addListener('fileOpened', handle);
  await OpenFile.addListener('openFileError', (e) => onError(e?.message ?? '文件读取失败'));
  try {
    const initial = await OpenFile.getInitialFile();
    if (initial?.error) {
      onError(initial.error);
      return;
    }
    handle(initial);
  } catch {
    // 冷启动没有文件：正常情况，静默
  }
}

async function parseNativeFile(f: { name?: string; base64?: string }): Promise<OpenedNativeFile> {
  const { sheets } = await tablesFromBuffer(decodeBase64(f.base64 ?? ''));
  return { name: f.name ?? '外部文件', sheets };
}
