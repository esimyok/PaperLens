// 设置面板 / 导出备份 / 列设置（原版 1459–1622 行）
import { store, persistSettings, persistRecords } from '../core/store.js';
import * as storage from '../storage/index.js';
import { PROVIDERS } from '../ai/providers.js';
import { exportCols, buildMarkdownTable } from '../domain/exporters.js';
import { DETAIL_FIELDS, FIELD_LABELS } from '../contract/fields.js';
import { $, esc, toast, openMenu } from './dom.js';
import { render } from './render.js';
import { refreshChatModelBar } from './chat.js';

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- 导出 / 备份 ---------- */
export function initExportMenu() {
  $('#btn-export').addEventListener('click', (e) => {
    e.stopPropagation();
    if (store.records.length === 0) { toast('暂无数据可导出', 'warn'); return; }
    openMenu(e.currentTarget, [
      { label: '导出 CSV（Excel 直开）', action: () => {
        const cols = exportCols();
        const cell = (v) => {
          let s = Array.isArray(v) ? v.join('; ') : String(v ?? '');
          s = s.replace(/\r?\n/g, ' ');
          return '"' + s.replace(/"/g, '""') + '"';
        };
        const lines = [cols.map((c) => c.label).map(cell).join(',')].concat(
          store.records.map((r) => cols.map((c) => cell(r[c.key])).join(',')),
        );
        downloadFile('\uFEFF' + lines.join('\r\n'),
          '文献提炼表_' + new Date().toISOString().slice(0, 10) + '.csv', 'text/csv;charset=utf-8;');
        toast('CSV 已导出', 'ok');
      } },
      { label: '导出 Markdown 表格', action: () => {
        downloadFile(buildMarkdownTable(store.records),
          '文献提炼表_' + new Date().toISOString().slice(0, 10) + '.md', 'text/markdown;charset=utf-8;');
        toast('Markdown 已导出', 'ok');
      } },
      { sep: true },
      { label: '导出备份（JSON，含全文）', action: () => {
        const data = {
          app: 'SiftLit', version: 2, exported_at: new Date().toISOString(),
          records: store.records.map((r) => { const { text, ...rest } = r; return rest; }),
          texts: store.textCache,
        };
        downloadFile(JSON.stringify(data, null, 1),
          'paperlens_backup_' + new Date().toISOString().slice(0, 10) + '.json', 'application/json');
        toast('备份已导出（表格 + 全文）', 'ok');
      } },
      { label: '导入备份（JSON）', action: () => $('#backup-input').click() },
    ]);
  });

  $('#backup-input').addEventListener('change', async () => {
    const f = $('#backup-input').files[0];
    $('#backup-input').value = '';
    if (!f) return;
    if (store.busy) { toast('正在分析中，请等当前任务完成后再导入', 'warn', 5000); return; }
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'SiftLit' || !Array.isArray(data.records)) throw new Error('不是有效的 SiftLit 备份文件');
      if (!confirm(`导入将覆盖当前 ${store.records.length} 条记录，替换为备份中的 ${data.records.length} 条，继续？`)) return;
      store.records = data.records;
      for (const k of Object.keys(store.textCache)) delete store.textCache[k];
      Object.assign(store.textCache, data.texts || {});
      for (const r of store.records) r.text = store.textCache[r.id] || '';
      await storage.clearText();
      for (const [k, v] of Object.entries(store.textCache)) await storage.setText(k, v);
      store.selectedIds.clear();
      store.expandedIds.clear();
      persistRecords();
      render();
      toast(`已导入 ${store.records.length} 条记录`, 'ok');
    } catch (err) {
      toast('导入失败：' + err.message, 'err');
    }
  });
}

/* ---------- 设置面板 ---------- */
function updateProxyHint() {
  const line = $('#proxy-line');
  if (line) line.classList.toggle('show', !store.bridgeAvailable);
}

function fillProviderUI() {
  const pid = $('#inp-provider').value;
  const P = PROVIDERS[pid];
  const saved = store.settings.providers[pid] || {};
  $('#inp-key').value = saved.key || '';
  $('#inp-model').value = saved.model || P.models[0];
  $('#key-hint').innerHTML = `获取 Key：<a href="https://${esc(P.site)}" target="_blank" rel="noopener">${esc(P.site)}</a>${P.note ? '（' + esc(P.note) + '）' : ''}`;
  $('#model-list').innerHTML = P.models.map((m) => `<option value="${esc(m)}">`).join('');
}

export function initSettings() {
  $('#btn-settings').addEventListener('click', () => {
    $('#inp-provider').innerHTML = Object.entries(PROVIDERS)
      .map(([id, p]) => `<option value="${id}" ${id === store.settings.provider ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    fillProviderUI();
    updateProxyHint();
    $('#settings-mask').classList.add('show');
  });
  $('#inp-provider').addEventListener('change', fillProviderUI);
  $('#btn-cancel').addEventListener('click', () => $('#settings-mask').classList.remove('show'));
  $('#btn-cancel2').addEventListener('click', () => $('#settings-mask').classList.remove('show'));
  $('#settings-mask').addEventListener('click', (e) => { if (e.target.id === 'settings-mask') $('#settings-mask').classList.remove('show'); });
  $('#btn-save').addEventListener('click', () => {
    const pid = $('#inp-provider').value;
    store.settings.provider = pid;
    store.settings.providers[pid] = {
      key: $('#inp-key').value.trim(),
      model: $('#inp-model').value.trim() || PROVIDERS[pid].models[0],
    };
    delete store.settings.apiKey; delete store.settings.model;
    persistSettings();
    $('#settings-mask').classList.remove('show');
    refreshChatModelBar();
    toast('设置已保存（当前：' + PROVIDERS[pid].name + '）', 'ok', 2500);
  });
}

/* ---------- 列设置 ---------- */
function showColsMenu(anchor) {
  const s = store.settings;
  const items = [];
  items.push({ title: '行内列' });
  items.push({ label: (s.rowCols.keywords ? '☑' : '☐') + ' 关键词列', action: () => { s.rowCols.keywords = !s.rowCols.keywords; persistSettings(); render(); showColsMenu(anchor); } });
  items.push({ label: (s.rowCols.summary ? '☑' : '☐') + ' 一句话总结列', action: () => { s.rowCols.summary = !s.rowCols.summary; persistSettings(); render(); showColsMenu(anchor); } });
  items.push({ label: (s.rowCols.subline ? '☑' : '☐') + ' 副行（作者·年份·文件名）', action: () => { s.rowCols.subline = !s.rowCols.subline; persistSettings(); render(); showColsMenu(anchor); } });
  items.push({ title: '明细字段（默认收起）' });
  for (const k of DETAIL_FIELDS) {
    items.push({ label: (s.hiddenCols.includes(k) ? '☐' : '☑') + ' ' + FIELD_LABELS[k], action: () => {
      const i = s.hiddenCols.indexOf(k);
      if (i < 0) s.hiddenCols.push(k); else s.hiddenCols.splice(i, 1);
      persistSettings(); render(); showColsMenu(anchor);
    } });
  }
  items.push({ sep: true });
  items.push({ label: '恢复默认', action: () => {
    s.rowCols = { keywords: true, summary: true, subline: true };
    s.hiddenCols = ['data_and_sample', 'innovation', 'limitations'];
    persistSettings(); render(); showColsMenu(anchor);
  } });
  openMenu(anchor, items, true);
}

export function initColumnsMenu() {
  $('#btn-cols').addEventListener('click', (e) => { e.stopPropagation(); showColsMenu(e.currentTarget); });
}
