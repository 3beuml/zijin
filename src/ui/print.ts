/**
 * 周手册的 A4 打印形态：两路输出——
 * 1. 应用内 @media print（styles.css）：直接 window.print()
 * 2. 独立 HTML 文件（本模块）：可分享、可在任何浏览器打开打印，安卓上走系统分享
 * 本文件属界面层，允许用 window/navigator；不许反过来被 domain import。
 */
import type { AppData } from '../domain/types.ts';
import { weeklySummary } from '../domain/weekly.ts';
import { shortDate } from './util.ts';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildWeeklyHtml(data: AppData, refDate: string, teacherLine = ''): string {
  const week = weeklySummary(data.students, data.records, refDate);
  const weekRecords = data.records
    .filter((r) => r.date >= week.start && r.date <= week.end)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const nameOf = (id: string): string => data.students.find((s) => s.id === id)?.name ?? '?';

  const uncoveredRows = week.uncovered
    .map(
      (s) =>
        `<tr><td>${esc(s.name)}</td><td>${esc(s.advisor || '未分包')}</td><td class="c">待联系</td></tr>`,
    )
    .join('');

  const recordRows = weekRecords
    .map(
      (r) =>
        `<tr><td class="c">${esc(shortDate(r.date))}</td><td>${esc(nameOf(r.studentId))}</td><td class="c">${esc(r.type)}</td><td>${esc(r.content)}</td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>子衿周手册 ${esc(week.start)} – ${esc(week.end)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: system-ui, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
         font-size: 10.5pt; line-height: 1.6; color: #1f2328; margin: 0; }
  h1 { font-size: 16pt; margin: 0 0 2mm; }
  h2 { font-size: 12pt; margin: 8mm 0 2mm; border-bottom: 1px solid #ccc; padding-bottom: 1mm; }
  .meta { color: #555; font-size: 9pt; margin-bottom: 4mm; }
  .kpi { font-size: 14pt; font-weight: 600; margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th, td { border: 1px solid #bbb; padding: 1.5mm 2mm; text-align: left; }
  th { background: #f2f0ec; }
  td.c, th.c { text-align: center; }
  .foot { margin-top: 8mm; color: #888; font-size: 8.5pt; }
</style>
</head>
<body>
  <h1>周手册（${esc(shortDate(week.start))} – ${esc(shortDate(week.end))}）</h1>
  <div class="meta">${esc(teacherLine)}学生 ${week.total} 人 · 本周记录 ${weekRecords.length} 条 · 生成于 ${esc(new Date().toLocaleDateString('zh-CN'))}</div>
  <div class="kpi">本周已沟通 ${week.covered}/${week.total}</div>

  <h2>本周未覆盖（${week.uncovered.length} 人）</h2>
  <table>
    <thead><tr><th>姓名</th><th>导师</th><th class="c">状态</th></tr></thead>
    <tbody>${uncoveredRows || '<tr><td colspan="3" class="c">全部覆盖</td></tr>'}</tbody>
  </table>

  <h2>本周记录（${weekRecords.length} 条）</h2>
  <table>
    <thead><tr><th class="c" style="width:18mm">日期</th><th style="width:20mm">姓名</th><th class="c" style="width:16mm">类型</th><th>内容</th></tr></thead>
    <tbody>${recordRows || '<tr><td colspan="4" class="c">本周暂无记录</td></tr>'}</tbody>
  </table>

  <div class="foot">子衿 · 本地生成，不含云端上传</div>
</body>
</html>`;
}

/** 触发下载（浏览器）；返回文件名 */
export function downloadFile(content: string, fileName: string, mime: string): string {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = fileName;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return fileName;
}

/** 安卓上优先走系统分享（可分享给微信/打印服务），浏览器里退回下载 */
export async function shareOrDownloadHtml(html: string, fileName: string): Promise<'shared' | 'downloaded'> {
  const blob = new Blob([html], { type: 'text/html' });
  const file = new File([blob], fileName, { type: 'text/html' });
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
    share?: (d: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      return 'shared';
    } catch {
      // 用户取消分享 → 落回下载
    }
  }
  downloadFile(html, fileName, 'text/html');
  return 'downloaded';
}
