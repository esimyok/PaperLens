// 页面骨架 + 事件接线（原版 body 结构与交互 311–464 / 1117–1870 行的模块化移植）
import {
  store, subscribe, notify, addRecord, removeRecord, persistRecords, persistSettings,
} from '../core/store.js';
import { appQueue } from '../core/queue.js';
import { createRecord, processRecord, loadSamples } from '../domain/record.js';
import { parseLink, fetchArxiv, fetchDoi, pdfBase64ToFile } from '../domain/sources.js';
import { citeGBT, citeAPA } from '../domain/citations.js';
import { buildMarkdownTable } from '../domain/exporters.js';
import { SYSTEM_PROMPT, JSON_SCHEMA_HINT, TRANSLATE_PROMPT } from '../ai/providers.js';
import { callAIWithRetry } from '../ai/client.js';
import { normalizeJson, extractJsonText, truncateText } from '../ai/parse.js';
import { $, esc, toast, copyText, openMenu, initMenuDismiss } from './dom.js';
import { renderRows, updateBadge } from './rows.js';
import { registerRender, registerUpdateBadge, render } from './render.js';
import { filteredRecords, refreshFilterOptions, initFilters } from './filters.js';
import { updateChatBadge, rowClick, initChat } from './chat.js';
import { initSettings, initExportMenu, initColumnsMenu } from './settings.js';
import { initStats } from './stats.js';
import { initZotero, setZoteroLink } from './zotero.js';
import { initA11y } from './a11y.js';

const SYMBOLS = `
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="i-lens" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.5"/><path d="M15 15l5.5 5.5"/></symbol>
  <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 15V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.5"/><path d="M15 15l5.5 5.5"/></symbol>
  <symbol id="i-columns" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M10 4v16M15.5 4v16"/></symbol>
  <symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/></symbol>
  <symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20h16"/><path d="M7 20v-7M12 20V6M17 20v-10"/></symbol>
  <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></symbol>
  <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 13.5A8.5 8.5 0 1 1 10.5 4 6.8 6.8 0 0 0 20 13.5Z"/></symbol>
  <symbol id="i-chat" viewBox="0 0 24 24"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 4v-4H6a2 2 0 0 1-2-2V6Z"/></symbol>
  <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></symbol>
  <symbol id="i-chev-d" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>
  <symbol id="i-chev-r" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></symbol>
  <symbol id="i-more" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/></symbol>
  <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 3.5V8h-4.5"/></symbol>
  <symbol id="i-quote" viewBox="0 0 24 24"><path d="M5.5 13.5c0-4 2.2-6.6 5-7.5l.7 1.6c-1.9.8-3 2.2-3.2 3.9H10V16H5.5v-2.5ZM13.5 13.5c0-4 2.2-6.6 5-7.5l.7 1.6c-1.9.8-3 2.2-3.2 3.9H18V16h-4.5v-2.5Z"/></symbol>
  <symbol id="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/></symbol>
  <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2"/><path d="M6.5 7l1 12a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12"/></symbol>
  <symbol id="i-close" viewBox="0 0 24 24"><path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/></symbol>
  <symbol id="i-send" viewBox="0 0 24 24"><path d="M20 12L4 4l3 8-3 8 16-8Z"/><path d="M7 12h13"/></symbol>
  <symbol id="i-gift" viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 13h16M12 9v11"/><path d="M12 9c-4.5 0-5.5-2-4.7-3.6.8-1.5 3.2-1 4.7 3.6 1.5-4.6 3.9-5.1 4.7-3.6C17.5 7 16.5 9 12 9Z"/></symbol>
  <symbol id="i-check-c" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/></symbol>
  <symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 4L2.8 19.5h18.4L12 4Z"/><path d="M12 10v4.2"/><circle cx="12" cy="17" r=".4"/></symbol>
  <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".4"/></symbol>
  <symbol id="i-loader" viewBox="0 0 24 24"><path d="M12 3.5A8.5 8.5 0 1 1 3.5 12"/></symbol>
</svg>`;

const TEMPLATE = `
${SYMBOLS}
<header id="topbar">
  <div class="brand">
    <svg class="icon logo-img"><use href="#i-lens"/></svg>
    <b>SiftLit</b><span class="vline"></span><span class="sub">文献智能提炼表格</span>
  </div>
  <div class="actions">
    <button class="btn ghost" id="btn-chat"><svg class="icon"><use href="#i-chat"/></svg><span id="btn-chat-label">问答</span><em id="chat-badge" hidden></em></button>
    <button class="btn ghost" id="btn-stats"><svg class="icon"><use href="#i-chart"/></svg>统计</button>
    <button class="btn ghost icon-only" id="btn-theme" title="切换深色 / 浅色"><svg class="icon" id="theme-ic"><use href="#i-moon"/></svg></button>
    <button id="btn-zotero" data-state="off" title="开启后在 Zotero 中选中文献，本页自动抓取并分析"><i class="dot"></i><span id="zotero-label">Zotero 关</span></button>
    <button class="btn ghost" id="btn-export"><svg class="icon"><use href="#i-download"/></svg>导出<svg class="icon sm"><use href="#i-chev-d"/></svg></button>
    <button class="btn ghost" id="btn-settings"><svg class="icon"><use href="#i-gear"/></svg>设置</button>
  </div>
</header>

<main id="page">
  <section id="empty" hidden>
    <svg class="icon lens-hero"><use href="#i-lens"/></svg>
    <h1>把一堆 PDF，变成一张能用的表</h1>
    <div class="lead">拖入文献，AI 读完自动填好方法、结论、创新点。数据只留在你这台电脑上。</div>
    <div class="steps">① <b>配置 AI Key</b> → ② <b>拖入 PDF</b> → ③ <b>自动生成表格</b></div>
    <div class="cta">
      <button class="btn primary" id="btn-setup-ai"><svg class="icon"><use href="#i-gear"/></svg>配置 AI Key</button>
      <button class="btn" id="btn-sample"><svg class="icon"><use href="#i-gift"/></svg>加载 3 篇示例数据</button>
    </div>
    <div class="dz" id="drop-hero">
      <div class="main-line">将 PDF 拖到此处，或点击选择文件（可多选）</div>
      <div class="sub-line">支持扫描件自动 OCR · 点行选中后可向 AI 提问 · Ctrl+点击多选合并问答</div>
    </div>
    <div class="linkrow">
      <input id="link-in" placeholder="粘贴 arXiv 链接 / DOI（如 10.1038/xxx），回车导入：arXiv 自动下载 PDF 分析，DOI 先导入元数据">
      <button class="btn" id="btn-link">导入</button>
    </div>
  </section>

  <section id="dataui" hidden>
    <div class="bar dz" id="dropbar">
      <div class="dz-label" id="dz-label">
        <svg class="icon" style="color:var(--primary-ink)"><use href="#i-upload"/></svg>
        <span><b>拖入 PDF</b> / 点击选择（可多选）</span>
      </div>
      <input id="link-in2" placeholder="粘贴 arXiv 链接或 DOI" style="flex:1;min-width:200px;height:30px;padding:0 10px;font-family:var(--font-mono);font-size:12.5px;">
      <button class="btn sm" id="btn-link2">导入</button>
    </div>
    <div class="bar filter-bar">
      <svg class="icon sm" style="color:var(--ink-3)"><use href="#i-search"/></svg>
      <input id="f-q" placeholder="搜标题、作者、关键词、结论…">
      <select id="f-year"><option value="all">年份：全部</option></select>
      <select id="f-kw"><option value="all">关键词：全部</option></select>
      <select id="f-status">
        <option value="all">状态：全部</option>
        <option value="done">完成</option><option value="fail">失败</option>
        <option value="ai">AI 分析中</option><option value="parsing">解析中</option>
      </select>
      <button class="btn sm" id="f-clear">清除筛选</button>
      <button class="btn sm" id="btn-cols"><svg class="icon sm"><use href="#i-columns"/></svg>列设置</button>
      <div class="grow"><span id="f-count" class="num"></span></div>
    </div>
    <div class="rows-outer">
      <div class="rows-head">
        <span></span><span>状态</span><span>标题 / 作者 · 年份 · 文件名</span><span>关键词</span><span>一句话总结</span><span style="text-align:right;">操作</span>
      </div>
      <div id="rows"></div>
    </div>
  </section>
</main>

<aside id="chat-panel">
  <div class="chat-head">
    <div class="t">
      <b><svg class="icon sm"><use href="#i-chat"/></svg>文献问答</b>
      <div class="chat-paper" id="chat-paper">未选择文献 —— 点击表格任意一行</div>
    </div>
    <button class="btn sm" id="chat-clear">清空</button>
    <button class="icon-btn" id="chat-close" title="收起"><svg class="icon sm"><use href="#i-close"/></svg></button>
  </div>
  <div id="chat-msgs"></div>
  <div class="chat-modelbar">
    <select id="chat-provider" title="切换 AI 服务商"></select>
    <input id="chat-model" list="chat-model-list" placeholder="模型名，可手动输入">
    <datalist id="chat-model-list"></datalist>
    <button class="btn sm" id="chat-manage">管理</button>
  </div>
  <div class="chat-input">
    <textarea id="chat-in" placeholder="基于选中的文献提问…"></textarea>
    <button class="btn primary" id="chat-send" style="height:40px;"><svg class="icon"><use href="#i-send"/></svg></button>
  </div>
  <div class="chat-keyhint">Enter 发送 · Shift+Enter 换行 · 多篇文献可合并提问</div>
</aside>

<div id="dragmask" hidden><div class="inner">松手，开始解析</div></div>

<div class="modal-mask" id="settings-mask">
  <div class="modal">
    <h2>设置<button class="icon-btn x" id="btn-cancel"><svg class="icon sm"><use href="#i-close"/></svg></button></h2>
    <label>AI 服务商</label>
    <select id="inp-provider"></select>
    <label>API Key（当前服务商）</label>
    <input type="password" id="inp-key" placeholder="请输入 API Key，仅保存在本机浏览器">
    <div class="hint" id="key-hint"></div>
    <label>模型（直接手动输入即可，下拉仅为常用建议）</label>
    <input type="text" id="inp-model" list="model-list" placeholder="模型名">
    <datalist id="model-list"></datalist>
    <div class="proxy-warn" id="proxy-line">⚠ 未检测到本地服务 —— 当前为纯静态模式：AI 走浏览器直连（OpenAI / Gemini 会被 CORS 拦截），Zotero 不可用。请改用本地服务打开（开发 <b>npm run dev</b>，生产 <b>npm run build &amp;&amp; npm start</b>）。</div>
    <div class="foot">
      <button class="btn" id="btn-cancel2">取消</button>
      <button class="btn primary" id="btn-save">保存</button>
    </div>
  </div>
</div>

<div class="modal-mask" id="stats-mask">
  <div class="modal" style="width:640px;">
    <h2>统计<button class="icon-btn x" id="btn-stats-close"><svg class="icon sm"><use href="#i-close"/></svg></button></h2>
    <div id="stats-body"></div>
  </div>
</div>

<div id="menu" class="menu" hidden></div>
<div id="toast-box"></div>
<input type="file" id="file-input" accept=".pdf" multiple hidden>
<input type="file" id="backup-input" accept=".json" hidden>
`;

/* ---------- 主题 ---------- */
export function applyTheme() {
  const dark = store.settings.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : '';
  $('#theme-ic').innerHTML = `<use href="#${dark ? 'i-sun' : 'i-moon'}"/>`;
}

/* ---------- 处理流程 ---------- */
function handleFiles(fileList) {
  const pdfs = [...fileList].filter((f) => /\.pdf$/i.test(f.name));
  if (pdfs.length === 0) { toast('仅支持 .pdf 文件', 'err'); return; }
  for (const f of pdfs) {
    const rec = createRecord({ filename: f.name, status: 'parsing', statusText: '', errMsg: '', text: '' });
    addRecord(rec); render();
    appQueue.add(rec.id, async () => {
      store.busy = true; render();
      try {
        await processRecord(rec, f, store.settings, (iOrRec, total) => {
          if (typeof iOrRec === 'number' && total) rec.statusText = `第 ${iOrRec}/${total} 页`;
          updateBadge(rec.id);
        });
        toast(`「${rec.filename}」分析完成`, 'ok');
      } catch (err) {
        rec.status = 'fail'; rec.statusText = '失败'; rec.errMsg = err.message || '未知错误';
        toast(`「${rec.filename}」处理失败：${rec.errMsg}`, 'err');
      } finally {
        store.busy = false; persistRecords(); render();
      }
    });
  }
}

async function importLink(raw) {
  const target = parseLink(raw);
  if (!target) { toast('无法识别：请粘贴 arXiv 链接（arxiv.org/abs/…）或 DOI（10.xxxx/…）', 'warn', 5000); return; }
  if (target.type === 'arxiv') {
    toast(`正在从 arXiv 下载 ${target.id} 的 PDF…`, 'ok', 4000);
    try {
      const d = await fetchArxiv(target.id);
      handleFiles([pdfBase64ToFile(d.pdf_base64, d.filename)]);
    } catch (err) {
      toast('arXiv 下载失败：' + err.message, 'err');
    }
  } else {
    toast('正在从 Crossref 获取 DOI 元数据…', 'ok', 3000);
    try {
      const m = await fetchDoi(target.id);
      const rec = createRecord({
        filename: target.id + '.doi', zoteroKey: null,
        status: 'fail', statusText: '缺 PDF',
        errMsg: '元数据已从 Crossref 导入；未找到公开 PDF，请上传该文献的 PDF 文件后点「重新分析」',
        title: m.title, authors: m.authors, year: m.year,
      });
      addRecord(rec); render();
      toast(`已导入 DOI 元数据：「${rec.title}」`, 'ok');
    } catch (err) {
      toast('DOI 导入失败：' + err.message, 'err');
    }
  }
}

function translateRec(rec) {
  appQueue.add('tr-' + rec.id, async () => {
    store.busy = true; rec.translating = true; render();
    try {
      const src = JSON.stringify({
        title: rec.title, one_sentence_summary: rec.one_sentence_summary,
        main_findings: rec.main_findings, research_question: rec.research_question, methodology: rec.methodology,
      });
      const raw = await callAIWithRetry([
        { role: 'system', content: TRANSLATE_PROMPT },
        { role: 'user', content: src },
      ], store.settings, { json: true });
      const r = JSON.parse(extractJsonText(raw));
      rec.title_zh = r.title_zh || '';
      rec.summary_zh = r.summary_zh || '';
      rec.findings_zh = r.findings_zh || '';
      rec.rq_zh = r.rq_zh || '';
      rec.method_zh = r.method_zh || '';
      toast(`「${rec.filename}」翻译完成（标题/研究问题/方法/结论/总结）`, 'ok');
    } catch (err) {
      toast(`翻译失败：${err.message}`, 'err');
    } finally {
      rec.translating = false; store.busy = false; persistRecords(); render();
    }
  });
}

/* ---------- 渲染 ---------- */
function doRender() {
  const hasData = store.records.length > 0;
  $('#empty').hidden = hasData;
  $('#dataui').hidden = !hasData;
  updateChatBadge();
  if (!hasData) return;
  refreshFilterOptions();
  const list = filteredRecords();
  $('#f-count').innerHTML = `<b>${list.length}</b>/${store.records.length} 篇`;
  renderRows($('#rows'), list, {
    settings: store.settings,
    selectedIds: store.selectedIds,
    expandedIds: store.expandedIds,
    detailAllIds: store.detailAllIds,
  });
}

/* ---------- 行事件 ---------- */
function initRowEvents() {
  $('#rows').addEventListener('click', (e) => {
    const row = e.target.closest('.row[data-id]');
    const btn = e.target.closest('button[data-act], button.r-exp');
    if (btn && row) {
      const id = row.dataset.id;
      const rec = store.records.find((r) => r.id === id);
      if (!rec) return;
      const act = btn.dataset.act;
      if (btn.classList.contains('r-exp')) {
        store.expandedIds.has(id) ? store.expandedIds.delete(id) : store.expandedIds.add(id);
        render();
        return;
      }
      if (act === 'toggle-extra') {
        store.detailAllIds.has(id) ? store.detailAllIds.delete(id) : store.detailAllIds.add(id);
        render();
        return;
      }
      if (act === 'reanalyze') {
        if (!rec.text) { toast('该记录没有已提取的文本，请重新上传原 PDF 文件', 'warn'); return; }
        appQueue.add(rec.id, async () => {
          store.busy = true;
          try {
            rec.status = 'ai'; rec.statusText = 'AI 分析中…'; rec.errMsg = ''; updateBadge(id);
            const raw = await callAIWithRetry([
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: truncateText(rec.text) + JSON_SCHEMA_HINT },
            ], store.settings, { json: true });
            Object.assign(rec, normalizeJson(JSON.parse(extractJsonText(raw))));
            rec.status = 'done'; rec.statusText = '完成';
            toast(`「${rec.filename}」重新分析完成`, 'ok');
          } catch (err) {
            rec.status = 'fail'; rec.statusText = '失败'; rec.errMsg = err.message;
            toast(`重新分析失败：${err.message}`, 'err');
          } finally { store.busy = false; persistRecords(); render(); }
        });
        return;
      }
      if (act === 'translate') {
        if (rec.translating) return;
        if (rec.title_zh || rec.summary_zh || rec.findings_zh || rec.rq_zh || rec.method_zh) {
          delete rec.title_zh; delete rec.summary_zh; delete rec.findings_zh; delete rec.rq_zh; delete rec.method_zh;
          persistRecords(); render();
          toast('已取消翻译，恢复英文原文', 'ok', 1500);
        } else {
          translateRec(rec);
        }
        return;
      }
      if (act === 'cite') {
        e.stopPropagation();
        openMenu(btn, [
          { label: 'GB/T 7714（国标）', action: () => copyText(citeGBT(rec), '已复制 GB/T 7714 引用') },
          { label: 'APA', action: () => copyText(citeAPA(rec), '已复制 APA 引用') },
          { label: '本行（Markdown 表格）', action: () => copyText(buildMarkdownTable([rec]), '已复制本行 Markdown') },
        ]);
        return;
      }
      if (act === 'delete') {
        row.classList.add('confirming');
        const t = setTimeout(() => { row.classList.remove('confirming'); store.deleteArm.delete(id); }, 3000);
        store.deleteArm.set(id, t);
        return;
      }
      if (act === 'del-yes') {
        if (store.deleteArm.has(id)) { clearTimeout(store.deleteArm.get(id)); store.deleteArm.delete(id); }
        removeRecord(id);
        if (store.selectedId === id) store.selectedId = store.selectedIds.values().next().value || null;
        render(); toast('已删除', 'ok', 1500);
        return;
      }
      if (act === 'del-no') {
        if (store.deleteArm.has(id)) { clearTimeout(store.deleteArm.get(id)); store.deleteArm.delete(id); }
        row.classList.remove('confirming');
        return;
      }
      return;
    }
    if (e.target.closest('.orig-toggle')) {
      const holder = e.target.closest('[data-field], .card') || e.target.parentElement;
      const o = holder.querySelector('.orig-block');
      if (o) {
        const clamped = o.classList.toggle('clamp3');
        e.target.textContent = clamped ? '原文 ▾' : '原文 ▴';
      }
      return;
    }
    if (e.target.closest('.ccopy')) {
      const holder = e.target.closest('[data-raw]') || e.target.closest('[data-field]');
      const rawv = holder && (holder.dataset.raw || (holder.querySelector('[data-raw]') || {}).dataset?.raw);
      if (rawv) copyText(rawv, '已复制单元格内容');
      return;
    }
    if (e.target.closest('.tag.more')) {
      const kwBox = e.target.closest('.r-kw');
      kwBox.classList.add('showall');
      kwBox.innerHTML = kwBox.dataset.all.split('、').map((k) => `<span class="tag">${esc(k)}</span>`).join('');
      return;
    }
    if (row) rowClick(row.dataset.id, e.ctrlKey || e.metaKey);
  });

  $('#rows').addEventListener('dblclick', (e) => {
    const card = e.target.closest('.card');
    const seg = e.target.closest('.seg[data-field]');
    const t = e.target.closest('[data-field="title"]');
    const kw = e.target.closest('.r-kw[data-field]');
    const sum = e.target.closest('[data-field="one_sentence_summary"]');
    let field = null, holder = null;
    if (card) { field = card.dataset.field; holder = card.querySelector('.val'); }
    else if (seg) { field = seg.dataset.field; holder = seg; }
    else if (t) { field = 'title'; holder = t; }
    else if (kw) { field = 'keywords'; holder = kw; }
    else if (sum) { field = 'one_sentence_summary'; holder = sum; }
    if (!field || field === 'filename') return;
    if (holder.querySelector('textarea')) return;
    const rec0 = e.target.closest('.row[data-id]');
    if (!rec0) return;
    const rec = store.records.find((r) => r.id === rec0.dataset.id);
    if (!rec) return;
    const isList = field === 'authors' || field === 'keywords';
    const cur = isList ? (Array.isArray(rec[field]) ? rec[field].join(', ') : (rec[field] ?? '')) : String(rec[field] ?? '');
    const editor = document.createElement('div');
    editor.style.width = '100%';
    editor.innerHTML = `<textarea class="cell-editor"></textarea><div class="edit-hint">Enter 换行 · Ctrl+Enter 或失焦提交 · Esc 还原</div>`;
    const ta = editor.querySelector('textarea');
    ta.value = cur;
    holder.replaceWith(editor);
    ta.focus(); ta.select();
    let done = false;
    const commit = () => {
      if (done) return; done = true;
      const val = ta.value.trim();
      if (isList) {
        const arr = val ? val.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean) : [];
        rec[field] = arr.length ? arr : ['未提及'];
      } else {
        rec[field] = val || '未提及';
      }
      persistRecords(); render();
    };
    ta.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); ta.blur(); }
      if (ev.key === 'Escape') { done = true; render(); }
    });
    ta.addEventListener('blur', commit);
  });
}

/* ---------- 上传 / 拖拽 ---------- */
function initUpload() {
  const fi = $('#file-input');
  $('#dz-label').addEventListener('click', () => fi.click());
  $('#dropbar').addEventListener('click', (e) => { if (!e.target.closest('#link-in2') && !e.target.closest('#btn-link2')) fi.click(); });
  $('#drop-hero').addEventListener('click', () => fi.click());
  fi.addEventListener('change', () => { handleFiles(fi.files); fi.value = ''; });

  const go = (sel) => $(sel).addEventListener('click', () => { const v = $(sel).value; $(sel).value = ''; importLink(v); });
  go('#btn-link');
  go('#btn-link2');
  for (const sel of ['#link-in', '#link-in2']) {
    $(sel).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value; e.target.value = ''; importLink(v); } });
  }
  $('#btn-sample').addEventListener('click', () => {
    for (const rec of loadSamples()) addRecord(rec);
    render();
    toast('已加载 3 篇示例文献（真实经典论文，可随时删除）', 'ok');
  });
  $('#btn-setup-ai').addEventListener('click', () => $('#btn-settings').click());

  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    if ([...(e.dataTransfer?.types || [])].includes('Files')) { dragDepth++; $('#dragmask').hidden = false; }
  });
  window.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) $('#dragmask').hidden = true;
  });
  window.addEventListener('dragover', (e) => { e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0; $('#dragmask').hidden = true;
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });
}

/* ---------- 启动 ---------- */
export function renderShell(root) {
  store.toast = toast;
  root.innerHTML = TEMPLATE;

  registerRender(doRender);
  registerUpdateBadge(updateBadge);

  $('#btn-theme').addEventListener('click', () => {
    store.settings.theme = store.settings.theme === 'dark' ? 'light' : 'dark';
    persistSettings(); applyTheme();
  });

  initUpload();
  initRowEvents();
  initFilters();
  initChat();
  initSettings();
  initExportMenu();
  initColumnsMenu();
  initStats();
  initZotero();
  initA11y();
  initMenuDismiss();

  subscribe(doRender);
  doRender();
}

// boot() 之后调用：应用主题 + 依据桥可用性自动开启 Zotero
export function afterBoot() {
  applyTheme();
  const autoZ = store.settings.zotero !== false;
  if (autoZ && store.bridgeAvailable) {
    setZoteroLink(true);
  } else if (store.bridgeAvailable) {
    toast('桥接服务已就绪，点击右上角「Zotero」可开启', 'warn', 5000);
  }
}
