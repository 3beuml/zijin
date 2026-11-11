#!/usr/bin/env node
/**
 * T1 · CLI 包装：读 xlsx → 打印结构草图 JSON。
 *   node scripts/detect/cli.mjs reference/samples/sample-standard.xlsx
 */
import { readTable } from '../lib/read-table.mjs';
import { detect } from '../../src/domain/import/detect.ts';

const file = process.argv[2];
if (!file) {
  console.error('用法: node scripts/detect/cli.mjs <table.xlsx>');
  process.exit(2);
}
const { table, sheetName } = await readTable(file);
const sketch = detect(table);
console.log(JSON.stringify({ sheet: sheetName, ...sketch }, null, 2));
