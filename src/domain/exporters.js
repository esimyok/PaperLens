// 导出：CSV / Markdown 表格 / JSON 备份（从旧 index.html 934–985 行迁移扩展）
import { EXPORT_COLS, FIELD_LABELS } from '../contract/fields.js';

export function exportCols() {
  return EXPORT_COLS.map((k) => ({ key: k, label: FIELD_LABELS[k] || k }));
}

function mdCell(v) {
  return String(Array.isArray(v) ? v.join('; ') : (v ?? ''))
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

export function buildMarkdownTable(rows) {
  const cols = exportCols();
  const lines = [
    '| ' + cols.map((c) => c.label).join(' | ') + ' |',
    '|' + cols.map(() => '---').join('|') + '|',
  ];
  for (const r of rows) {
    lines.push('| ' + cols.map((c) => mdCell(r[c.key])).join(' | ') + ' |');
  }
  return lines.join('\n');
}

function csvCell(v) {
  const s = String(Array.isArray(v) ? v.join('; ') : (v ?? ''));
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCSV(rows) {
  const cols = exportCols();
  const head = cols.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => cols.map((c) => csvCell(r[c.key])).join(',')).join('\n');
  return '﻿' + head + '\n' + body; // BOM 保证 Excel 中文不乱码
}

export function toMarkdown(rows) {
  return buildMarkdownTable(rows);
}

// 备份含全文（textCache），便于清空后导入恢复
export function toBackup({ records, settings, textCache = {} }) {
  const recs = records.map((r) => ({ ...r, text: textCache[r.id] || '' }));
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), settings, records: recs },
    null,
    2,
  );
}
