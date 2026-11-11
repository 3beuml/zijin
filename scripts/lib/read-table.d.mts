import type { Cell } from '../../src/domain/import/types.ts';

export function readTable(file: string): Promise<{ table: Cell[][]; sheetName: string }>;
