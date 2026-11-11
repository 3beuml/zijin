/**
 * 基建（Node 侧）：xlsx 文件 → Cell[][]。归一化逻辑在 src/lib/xlsx.ts（同构共用）。
 */
import { readFileSync } from 'node:fs';
import { tableFromBuffer } from '../../src/lib/xlsx.ts';

export async function readTable(file) {
  const buf = readFileSync(file);
  // Node Buffer 是 ArrayBuffer 的视图，exceljs 两者都收
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return tableFromBuffer(arrayBuffer);
}
