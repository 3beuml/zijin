/**
 * 周手册的 A4 打印形态：两路输出——
 * 1. 应用内 @media print（styles.css）：直接 window.print()
 * 2. 独立 HTML 文件（本模块）：可分享、可在任何浏览器打开打印，安卓上走系统分享
 * 本文件属界面层，允许用 window/navigator；不许反过来被 domain import。
 */
import type { AppData } from '../domain/types.ts';
import { myStudents } from '../domain/students.ts';
import { nextWeekTodos } from '../domain/todo.ts';
import { fmtScore } from '../domain/format.ts';
import { weeklyRegister, weeklySummary } from '../domain/weekly.ts';
import { shortDate } from './util.ts';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildWeeklyHtml(data: AppData, refDate: string, teacherLine = ''): string {
  const mine = myStudents(data.students, data.settings.advisor);
  const scopeStudents = mine.length > 0 ? mine : data.students;
  const reg = weeklyRegister(scopeStudents, data.records, data.scores, data.exams, refDate);
  const week = weeklySummary(scopeStudents, data.records, refDate);
  const weekRecords = data.records
    .filter((r) => r.date >= reg.start && r.date <= reg.end)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const nameOf = (id: string): string => data.students.find((s) => s.id === id)?.name ?? '?';
  const advisorLabel = mine.length > 0 ? `分包 ${mine.length} 人` : `全班 ${data.students.length} 人`;

  const typeCols = ['沟通', '谈心', '家访'];
  const regRows = reg.rows
    .map((row) => {
      const last =
        row.total == null
          ? '—'
          : `${fmtScore(row.total)}${row.rank != null ? `（${row.poolLabel}第 ${row.rank} 名）` : ''}`;
      const count = (t: string): string => {
        const n =
          t === '其他'
            ? [...row.countByType.entries()].filter(([k]) => !typeCols.includes(k)).reduce((n, [, c]) => n + c, 0)
            : (row.countByType.get(t) ?? 0);
        return n ? String(n) : '—';
      };
      return `<tr class="${row.count === 0 ? 'empty' : ''}">
        <td>${esc(row.student.name)}</td>
        ${typeCols.map((t) => `<td class="c">${count(t)}</td>`).join('')}
        <td class="c">${count('其他')}</td>
        <td>${esc(last)}</td>
        <td>${esc(row.summary || '本周无记录')}</td>
      </tr>`;
    })
    .join('');

  const nextWeek = nextWeekTodos(data.todos, reg.end);
  const nextRows = nextWeek
    .slice(0, 10)
    .map(
      (t) =>
        `<tr><td class="c" style="width:22mm">${esc(t.due)}</td><td>${esc(t.title)}${t.studentId ? `（${esc(nameOf(t.studentId))}）` : ''}</td></tr>`,
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
<title>子衿周手册 ${esc(reg.start)} – ${esc(reg.end)}</title>
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
  tr.empty td { color: #b4731f; }
  .foot { margin-top: 8mm; color: #888; font-size: 8.5pt; }
</style>
</head>
<body>
  <h1>周手册（${esc(shortDate(reg.start))} – ${esc(shortDate(reg.end))}）</h1>
  <div class="meta">${esc(teacherLine)}${esc(advisorLabel)} · 本周记录 ${weekRecords.length} 条 · 生成于 ${esc(new Date().toLocaleDateString('zh-CN'))}</div>
  <div class="kpi">本周已沟通 ${week.covered}/${scopeStudents.length}</div>

  <h2>登记表（每人一行）</h2>
  <table>
    <thead><tr><th>学生</th>${typeCols.map((t) => `<th class="c">${t}</th>`).join('')}<th class="c">其他</th><th>最近成绩</th><th>本周摘要</th></tr></thead>
    <tbody>${regRows}</tbody>
  </table>

  <h2>下周重点（${nextWeek.length} 件）</h2>
  <table>
    <thead><tr><th class="c" style="width:22mm">截止</th><th>事项</th></tr></thead>
    <tbody>${nextRows || '<tr><td colspan="2" class="c">下周还没有安排</td></tr>'}</tbody>
  </table>

  <h2>本周记录明细（${weekRecords.length} 条）</h2>
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
  return downloadBlob(new Blob([content], { type: mime }), fileName);
}

/** Blob 版下载（xlsx 等二进制用） */
export function downloadBlob(blob: Blob, fileName: string): string {
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
