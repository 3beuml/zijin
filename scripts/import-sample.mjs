#!/usr/bin/env node
/**
 * 端到端导入：xlsx → detect → map（自动确认）→ commit → dump.json
 *
 * 用法：
 *   node scripts/import-sample.mjs <table.xlsx> <out.json> [--label 期中] [--demo-record]
 *
 * --demo-record：追加一条**虚构**的验证用记录（外部验收要求记录非空；
 *                真实记录应由老师在界面里记，不在这里造）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readTable } from './lib/read-table.mjs';
import { detect } from '../src/domain/import/detect.ts';
import { map } from '../src/domain/import/map.ts';
import { commit } from '../src/domain/import/commit.ts';

const args = process.argv.slice(2);
const file = args[0];
const out = args[1];
if (!file || !out) {
  console.error('用法: node scripts/import-sample.mjs <table.xlsx> <out.json> [--label 期中] [--demo-record]');
  process.exit(2);
}
const labelIdx = args.indexOf('--label');
const label = labelIdx >= 0 ? args[labelIdx + 1] : undefined;
const demoRecord = args.includes('--demo-record');

const { table, sheetName } = await readTable(file);
const sketch = detect(table);
const mapping = map(table, sketch, [], label ? { defaultExamLabel: label } : {});
const empty = { version: 1, students: [], exams: [], scores: [], records: [] };
const { data, report } = commit(empty, table, mapping, {
  examLabels: label ? { 2: label } : {},
});

let records = data.records;
if (demoRecord && data.students.length > 0) {
  const today = new Date().toISOString().slice(0, 10);
  records = [
    {
      id: 'r-demo-1',
      studentId: data.students[0].id,
      date: today,
      type: '沟通',
      content: '导入验证记录（CLI 自动生成，内容虚构，仅用于验收记录非空检查）',
      createdAt: new Date().toISOString(),
    },
  ];
}

const dump = { ...data, records };

writeFileSync(out, JSON.stringify(dump, null, 2), 'utf8');

console.log(`表: ${file} (sheet: ${sheetName})`);
console.log(`匹配模板: ${mapping.matchedTemplate ?? '无（启发式映射）'}`);
console.log(
  `学生: +${report.studentsCreated} 新 / ${report.studentsMatched} 匹配；考试: +${report.examsCreated}；分数: ${report.scoresWritten} 行`,
);
if (report.droppedRows.length) {
  console.log(`丢弃行: ${report.droppedRows.map((d) => `r${d.row}(${d.reason})`).join(' ')}`);
}
for (const w of report.warnings) console.log(`⚠ ${w}`);
console.log(`→ ${out}`);
