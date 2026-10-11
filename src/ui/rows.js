// 行 / 卡片 / 徽章渲染（原版 988–1108 行忠实移植）
import { DETAIL_FIELDS, FIELD_LABELS, ZH_FIELDS } from '../contract/fields.js';
import { store } from '../core/store.js';
import { esc } from './dom.js';
import { render } from './render.js';

export function badgeHtml(rec) {
  if (rec.translating) return `<span class="badge st-busy"><svg class="icon sm spin" style="animation:rot 1s linear infinite;"><use href="#i-loader"/></svg>翻译中…</span>`;
  if (rec.status === 'done') return `<span class="badge st-ok"><i class="dotc"></i>完成</span>`;
  if (rec.status === 'fail') {
    const missing = rec.statusText === '缺 PDF';
    const b = missing ? 'st-missing' : 'st-err';
    return `<span class="badge ${b}">${esc(rec.statusText === '已中断' ? '已中断' : (missing ? '缺 PDF' : '失败'))}</span>`;
  }
  if (rec.status === 'ai') {
    const m = /第 (\d+)\/(\d+) 页/.exec(rec.statusText || '');
    const mini = m ? `<i class="mini" style="width:${Math.round(m[1] / m[2] * 100)}%"></i>` : '';
    return `<span class="badge st-busy"><svg class="icon sm spin" style="animation:rot 1s linear infinite;"><use href="#i-loader"/></svg>${esc(rec.statusText || 'AI 分析中…')}${mini}</span>`;
  }
  const m = /第 (\d+)\/(\d+) 页/.exec(rec.statusText || '');
  const mini = m ? `<i class="mini" style="width:${Math.round(m[1] / m[2] * 100)}%"></i>` : '';
  return `<span class="badge st-busy"><svg class="icon sm spin" style="animation:rot 1s linear infinite;"><use href="#i-loader"/></svg>解析中${rec.statusText && m ? ' · ' + esc(rec.statusText) : ''}${mini}</span>`;
}

export function updateBadge(id) {
  const row = document.querySelector(`.row[data-id="${id}"]`);
  if (!row) { render(); return; }
  const rec = store.records.find((r) => r.id === id);
  if (!rec) return;
  row.querySelector('.r-status').innerHTML = badgeHtml(rec) +
    (rec.status === 'fail' && rec.errMsg ? `<div class="err-line" title="${esc(rec.errMsg)}">${esc(rec.errMsg)}</div>` : '');
}

function fieldDisplay(rec, key) {
  const zhKey = ZH_FIELDS[key];
  if (zhKey && rec[zhKey]) return { main: rec[zhKey], orig: rec[key] };
  return { main: rec[key], orig: null };
}

function cellRaw(rec, key) {
  const d = fieldDisplay(rec, key);
  if (key === 'keywords') return (Array.isArray(rec.keywords) ? rec.keywords : []).filter((x) => x && x !== '未提及').join('; ');
  return d.orig ? d.main + '\n' + d.orig : String(d.main ?? '');
}

function origToggleHtml() {
  return `<button class="orig-toggle" type="button">原文 ▾</button>`;
}

function cardHtml(rec, key) {
  const d = fieldDisplay(rec, key);
  let body = `<div class="val" data-raw="${esc(cellRaw(rec, key))}">${esc(d.main) || '<span style="color:var(--ink-3)">未提及</span>'}</div>`;
  if (d.orig !== null && d.orig !== undefined) {
    body += `<div class="orig-block clamp3" data-raw="${esc(cellRaw(rec, key))}">原文：${esc(d.orig)}</div>` + origToggleHtml();
  }
  return `<div class="card" data-field="${key}" data-label="${esc(FIELD_LABELS[key])}">
    <div class="lab">${esc(FIELD_LABELS[key])}${rec.translating && ['title', 'research_question', 'methodology', 'main_findings', 'one_sentence_summary'].includes(key) ? `<svg class="icon sm spin" style="animation:rot 1s linear infinite;color:var(--primary-ink)"><use href="#i-loader"/></svg>` : ''}</div>
    ${body}<button class="ccopy" title="复制本格"><svg class="icon sm"><use href="#i-copy"/></svg></button></div>`;
}

export function rowHtml(rec, ctx) {
  const { settings, selectedIds, expandedIds, detailAllIds } = ctx;
  const dTitle = fieldDisplay(rec, 'title');
  const sub = settings.rowCols.subline ? `<div class="sub"><span class="seg" data-field="authors">${esc((Array.isArray(rec.authors) ? rec.authors : []).join('; '))}</span> · <span class="seg num" data-field="year">${esc(rec.year || '—')}</span> · <span class="seg" title="${esc(rec.filename)}">${esc(rec.filename)}</span></div>` : '';
  const titleHtml = `<div class="t" data-field="title" data-raw="${esc(cellRaw(rec, 'title'))}">${esc(dTitle.main)}</div>` +
    (dTitle.orig ? `<div class="t-orig" title="${esc(dTitle.orig)}">原：${esc(dTitle.orig)}</div>` : '') + sub;
  let kwHtml = `<span style="color:var(--ink-3);font-size:12px;">—</span>`;
  if (settings.rowCols.keywords) {
    const kws = (Array.isArray(rec.keywords) ? rec.keywords : []).filter((k) => k && k !== '未提及');
    if (kws.length) {
      const shown = kws.slice(0, 2).map((k) => `<span class="tag">${esc(k)}</span>`).join('');
      const rest = kws.length > 2 ? `<span class="tag more" title="${esc(kws.slice(2).join('、'))}">+${kws.length - 2}</span>` : '';
      kwHtml = `<div class="r-kw" data-field="keywords" data-raw="${esc(cellRaw(rec, 'keywords'))}" data-all="${esc(kws.join('、'))}">${shown}${rest}</div>`;
    } else kwHtml = `<div class="r-kw" data-field="keywords" data-raw="">—</div>`;
  }
  let sumHtml = `<span style="color:var(--ink-3);font-size:12px;">—</span>`;
  if (settings.rowCols.summary) {
    const d = fieldDisplay(rec, 'one_sentence_summary');
    sumHtml = `<div data-field="one_sentence_summary" data-raw="${esc(cellRaw(rec, 'one_sentence_summary'))}">
      <div class="clamp2">${esc(d.main)}</div>
      ${d.orig ? `<span class="orig-block clamp3" data-o>${esc(d.orig)}</span>${origToggleHtml()}` : ''}
    </div><button class="ccopy" title="复制"><svg class="icon sm"><use href="#i-copy"/></svg></button>`;
  }
  const ops = `<div class="r-ops">
    <button class="icon-btn r-more" title="更多操作"><svg class="icon"><use href="#i-more"/></svg></button>
    <div class="ops-btns">
      <button class="icon-btn" data-act="reanalyze" title="重新分析"><svg class="icon"><use href="#i-refresh"/></svg></button>
      <button class="icon-btn" data-act="translate" title="${rec.translating ? '翻译中' : (rec.title_zh || rec.summary_zh || rec.findings_zh || rec.rq_zh || rec.method_zh) ? '取消翻译' : '翻译'}" ${rec.translating ? 'disabled' : ''}><span class="i-txt">Aa</span></button>
      <button class="icon-btn" data-act="cite" title="引用"><svg class="icon"><use href="#i-quote"/></svg></button>
      <button class="icon-btn" data-act="delete" title="删除"><svg class="icon"><use href="#i-trash"/></svg></button>
    </div>
    <div class="confirm-del">确认删除？
      <button class="icon-btn yes" data-act="del-yes" title="确认"><svg class="icon sm"><use href="#i-check-c"/></svg></button>
      <button class="icon-btn" data-act="del-no" title="取消"><svg class="icon sm"><use href="#i-close"/></svg></button>
    </div>
  </div>`;
  let detail = '';
  if (expandedIds.has(rec.id)) {
    const vis = DETAIL_FIELDS.filter((k) => !settings.hiddenCols.includes(k));
    const hid = DETAIL_FIELDS.filter((k) => settings.hiddenCols.includes(k));
    const cards = vis.map((k) => cardHtml(rec, k)).join('');
    const extra = (hid.length && detailAllIds.has(rec.id))
      ? `<div class="detail-grid" style="margin-top:12px;">${hid.map((k) => cardHtml(rec, k)).join('')}</div>` : '';
    const expander = hid.length
      ? `<div class="detail-extra"><button data-act="toggle-extra">${detailAllIds.has(rec.id) ? '▲ 收起附加字段' : `＋ ${hid.length} 个已收起字段`}</button></div>` : '';
    detail = `<div class="r-detail"><div class="detail-grid">${cards}</div>${extra}${expander}${rec.status === 'fail' && rec.errMsg ? `<div class="err-line" style="margin-top:8px;" title="${esc(rec.errMsg)}">${esc(rec.errMsg)}</div>` : ''}</div>`;
  }
  return `<div class="row ${selectedIds.has(rec.id) ? 'selected' : ''} ${expandedIds.has(rec.id) ? 'expanded' : ''}" data-id="${rec.id}">
    <div class="r-main">
      <button class="r-exp" title="展开 / 收起明细"><svg class="icon sm"><use href="#i-chev-r"/></svg></button>
      <div class="r-status">${badgeHtml(rec)}${rec.status === 'fail' && !expandedIds.has(rec.id) && rec.errMsg ? `<div class="err-line" title="${esc(rec.errMsg)}">${esc(rec.errMsg)}</div>` : ''}</div>
      <div class="r-title">${titleHtml}</div>
      <div class="r-kw-cell">${kwHtml}</div>
      <div class="r-sum">${sumHtml}</div>
      ${ops}
    </div>${detail}
  </div>`;
}

export function renderRows(container, list, ctx) {
  container.innerHTML = list.length
    ? list.map((r) => rowHtml(r, ctx)).join('')
    : `<div class="row"><div class="r-main" style="display:block;text-align:center;padding:32px;color:var(--ink-3);">没有符合筛选条件的文献</div></div>`;
}
