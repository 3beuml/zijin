#!/usr/bin/env node
/**
 * 子衿 · 外部验收脚本（agent 不许修改本文件）
 *
 * 用法：
 *   node scripts/accept.mjs <dump.json>
 *
 * 它只认数据契约，不读应用源码、不依赖应用自己写的测试。
 * 作用：防止「测试全绿但数据是错的」这种自欺欺人。
 *
 * 数据契约（应用必须能导出这个形状）：
 * {
 *   "version": 1,
 *   "students": [{ "id", "name", "classId", "advisor" }],
 *   "exams":    [{ "id", "label", "date", "order" }],
 *   "scores":   [{ "studentId", "examId", "subject", "raw", "rank",
 *                  "pool": { "subject", "tier", "scope" } }],
 *   "records":  [{ "studentId", "date", "type", "content" }]
 * }
 */

import { readFileSync } from 'node:fs';

const EXPECTED_STUDENTS = 33;
const SUBJECTS_FOR_TOTAL = ['语文', '数学', '英语', '物理'];

let failed = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m) => { failed++; console.log(`  ❌ ${m}`); };

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('用法: node scripts/accept.mjs <dump.json>');
    process.exit(2);
  }

  let d;
  try {
    d = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`❌ 读不了 JSON: ${e.message}`);
    process.exit(2);
  }

  console.log(`\n验收目标: ${file}\n`);

  // ---- 1. 基本结构 ----
  const need = ['students', 'exams', 'scores', 'records'];
  for (const k of need) {
    if (!Array.isArray(d[k])) bad(`缺少数组字段 "${k}"`);
  }
  if (failed) return finish();

  // ---- 2. 学生 ----
  if (d.students.length !== EXPECTED_STUDENTS) {
    bad(`学生数应为 ${EXPECTED_STUDENTS}，实际 ${d.students.length}`);
  } else {
    ok(`学生数 ${d.students.length}`);
  }
  const noAdvisor = d.students.filter((s) => !s.advisor);
  if (noAdvisor.length) bad(`${noAdvisor.length} 个学生没有导师（分包）`);
  else ok('每个学生都有导师');

  const noName = d.students.filter((s) => !s.name);
  if (noName.length) bad(`${noName.length} 个学生没有姓名`);

  // ---- 3. 隐私：不许出现真实手机号 ----
  const raw = JSON.stringify(d);
  const phones = raw.match(/1[3-9]\d{9}/g) || [];
  if (phones.length) bad(`出现 ${phones.length} 个疑似真实手机号`);
  else ok('无 11 位手机号');

  // ---- 4. 排名池不变量：同池内按分降序，rank 必须单调 ----
  const pools = new Map();
  for (const s of d.scores) {
    if (s.raw == null || s.rank == null) continue;
    const tier = s.pool?.tier ?? 'none';
    const scope = s.pool?.scope ?? 'unknown';
    const key = `${s.examId}|${s.subject}|${tier}|${scope}`;
    if (!pools.has(key)) pools.set(key, []);
    pools.get(key).push(s);
  }
  let checkedPools = 0;
  let inversions = 0;
  for (const [key, arr] of pools) {
    arr.sort((a, b) => b.raw - a.raw);
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i].raw > arr[i + 1].raw && arr[i].rank > arr[i + 1].rank) {
        inversions++;
        if (inversions <= 3) bad(`池 [${key}] 逆序: ${arr[i].raw}/${arr[i].rank} → ${arr[i+1].raw}/${arr[i+1].rank}`);
      }
    }
    checkedPools++;
  }
  if (inversions === 0) ok(`排名池内单调（检查了 ${checkedPools} 个池）`);
  else bad(`共有 ${inversions} 处池内逆序`);

  // ---- 5. 排名必须带池 ----
  const noPool = d.scores.filter((s) => s.rank != null && !s.pool);
  if (noPool.length) bad(`${noPool.length} 条名次没有标注所属池（违反「名次只在同池内可比」）`);
  else ok('所有名次都带池标注');

  // ---- 6. 总分自洽（有总分数据时）----
  const examIds = new Set(d.exams.map((e) => e.id));
  for (const eid of examIds) {
    const ofExam = d.scores.filter((s) => s.examId === eid);
    if (!ofExam.length) continue;
    const totals = ofExam.filter((s) => s.subject === '总分' || s.subject === 'total');
    if (!totals.length) continue;
    let badTotals = 0;
    for (const t of totals) {
      const parts = ofExam
        .filter((s) => s.studentId === t.studentId && SUBJECTS_FOR_TOTAL.includes(s.subject))
        .reduce((sum, s) => sum + Number(s.raw || 0), 0);
      if (Math.abs(parts - Number(t.raw)) > 1e-6) badTotals++;
    }
    if (badTotals) bad(`考试 ${eid} 有 ${badTotals} 个学生的总分不等于四科之和`);
    else ok(`考试 ${eid} 总分与四科之和对得上`);
  }

  // ---- 7. 记录 ----
  if (d.records.length === 0) bad('一条记录都没有，周手册会是空的');
  else ok(`记录 ${d.records.length} 条`);
  const orphan = d.records.filter((r) => !d.students.some((s) => s.id === r.studentId));
  if (orphan.length) bad(`${orphan.length} 条记录指向不存在的学生`);

  finish();
}

function finish() {
  console.log('');
  if (failed) {
    console.log(`验收失败：${failed} 项不通过。\n`);
    process.exit(1);
  }
  console.log('验收通过。\n');
  process.exit(0);
}

main();
