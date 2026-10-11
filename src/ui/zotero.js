// Zotero 联动（原版 1716–1810 行）——通过 bridge.getSelected() 轮询
import { store, addRecord, persistRecords, persistSettings } from '../core/store.js';
import { getBridge } from '../bridge/index.js';
import { getProviderCfg } from '../ai/providers.js';
import { createRecord, processRecord } from '../domain/record.js';
import { pdfBase64ToFile } from '../domain/sources.js';
import { appQueue } from '../core/queue.js';
import { $, toast } from './dom.js';
import { render, updateBadge } from './render.js';
import { rowClick } from './chat.js';

let zoteroTimer = null;
let lastZoteroKey = null;
let zoteroBridgeOk = null;

function setZoteroBtn(state, label) {
  const b = $('#btn-zotero');
  b.dataset.state = state;
  $('#zotero-label').textContent = label;
}

async function zoteroPoll() {
  let data;
  try {
    data = await getBridge().getSelected();
    if (data.error === 'no_bridge') throw new Error('no_bridge');
  } catch (e) {
    if (zoteroBridgeOk !== false) {
      zoteroBridgeOk = false;
      setZoteroBtn('err', 'Zotero 未连接');
      toast('Zotero 联动失败：请用本地服务打开本页（npm run dev 或 npm start），并确保 Zotero 已开启', 'err', 7000);
    }
    return;
  }
  if (zoteroBridgeOk !== true) {
    zoteroBridgeOk = true;
    setZoteroBtn('on', 'Zotero 监听中');
    toast('Zotero 联动已就绪：在 Zotero 中选中文献即可自动分析', 'ok');
  }
  if (data.error === 'bbt_missing') {
    lastZoteroKey = null;
    if (!zoteroPoll._bbtWarned) {
      zoteroPoll._bbtWarned = true;
      toast('Zotero 已连接，但 Better BibTeX 未就绪（未安装或启动失败，重启 Zotero 可恢复）', 'warn', 7000);
    }
    return;
  }
  if (data.error === 'local_api_disabled') {
    lastZoteroKey = null;
    if (!zoteroPoll._apiWarned) {
      zoteroPoll._apiWarned = true;
      toast('Zotero 本地 API 未开启。请在 Zotero 菜单「工具 → 开发者 → Run JavaScript」中运行：Zotero.Prefs.set("httpServer.localAPI.enabled", true)，然后重启 Zotero', 'warn', 12000);
    }
    return;
  }
  if (data.error === 'no_selection') { lastZoteroKey = null; return; }
  if (!data.key || data.key === lastZoteroKey) return;
  lastZoteroKey = data.key;
  if (data.error === 'no_pdf') { toast(`「${data.title || data.key}」没有找到 PDF 附件，跳过`, 'warn'); return; }
  const existing = store.records.find((r) => r.zoteroKey === data.key);
  if (existing) {
    const filled = [];
    const needTitle = !existing.title || existing.title === '—';
    const needYear = !existing.year || existing.year === '—';
    const needAuthors = !Array.isArray(existing.authors) || existing.authors.length === 0 ||
      (existing.authors.length === 1 && existing.authors[0] === '未提及');
    if (needTitle && data.title) { existing.title = data.title; filled.push('标题'); }
    if (needAuthors && Array.isArray(data.authors) && data.authors.length) { existing.authors = data.authors; filled.push('作者'); }
    if (needYear && data.year) { existing.year = data.year; filled.push('年份'); }
    if (filled.length) persistRecords();
    rowClick(existing.id, false);
    toast(filled.length
      ? `「${existing.title || existing.filename}」已在表格中，已补全${filled.join('/')}并选中该行`
      : `「${existing.title || existing.filename}」已在表格中，已为你选中该行`, 'ok', 4000);
    return;
  }
  zoteroAutoAdd(data);
}

async function zoteroAutoAdd(d) {
  if (!getProviderCfg(store.settings).key) { toast('Zotero：检测到新文献，但未配置 API Key，请在「设置」中填写', 'warn', 6000); return; }
  if (!d.pdf_base64) { toast(`「${d.title || d.key}」没有 PDF 内容可分析`, 'warn'); return; }
  const file = pdfBase64ToFile(d.pdf_base64, d.filename || (d.key + '.pdf'));
  const rec = createRecord({
    filename: file.name, zoteroKey: d.key, status: 'parsing',
    title: d.title || '—',
    authors: (Array.isArray(d.authors) && d.authors.length) ? d.authors : ['未提及'],
    year: d.year || '—',
  });
  addRecord(rec);
  render();
  toast(`Zotero：开始分析「${rec.title}」`, 'ok');
  appQueue.add(rec.id, async () => {
    store.busy = true; render();
    try {
      await processRecord(rec, file, store.settings, () => updateBadge(rec.id));
      toast(`「${rec.title}」分析完成`, 'ok');
    } catch (err) {
      rec.status = 'fail'; rec.statusText = '失败'; rec.errMsg = err.message || '未知错误';
      toast(`「${rec.title}」处理失败：${rec.errMsg}`, 'err');
    } finally {
      store.busy = false;
      persistRecords();
      render();
    }
  });
}

export function setZoteroLink(on) {
  store.settings.zotero = on;
  persistSettings();
  if (on) {
    setZoteroBtn('on', 'Zotero 监听中');
    zoteroPoll();
    zoteroTimer = setInterval(zoteroPoll, 2500);
  } else {
    if (zoteroTimer) { clearInterval(zoteroTimer); zoteroTimer = null; }
    zoteroBridgeOk = null; lastZoteroKey = null;
    zoteroPoll._bbtWarned = false; zoteroPoll._apiWarned = false;
    setZoteroBtn('off', 'Zotero 关');
  }
}

export function initZotero() {
  $('#btn-zotero').addEventListener('click', () => setZoteroLink(!store.settings.zotero));
}
