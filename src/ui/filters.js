// 筛选（原版 862–902 / 1449–1457 行）
import { store } from '../core/store.js';
import { $, esc } from './dom.js';
import { render } from './render.js';

export function statusLabel(r) {
  return { parsing: '解析中', ai: 'AI 分析中', done: '完成', fail: '失败' }[r.status] || '解析中';
}

export function filteredRecords() {
  const filters = store.filters;
  return store.records.filter((r) => {
    if (filters.year !== 'all' && String(r.year || '—') !== filters.year) return false;
    if (filters.status !== 'all' && statusLabel(r) !== filters.status) return false;
    if (filters.kw !== 'all' && !(Array.isArray(r.keywords) && r.keywords.includes(filters.kw))) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const hay = [r.filename, r.title, r.title_zh, r.one_sentence_summary, r.summary_zh, r.research_question,
        r.methodology, r.main_findings, r.innovation, r.limitations]
        .concat(Array.isArray(r.authors) ? r.authors : [r.authors])
        .concat(Array.isArray(r.keywords) ? r.keywords : [r.keywords])
        .join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function refreshFilterOptions() {
  const filters = store.filters;
  const years = [...new Set(store.records.map((r) => String(r.year || '—')))].filter(Boolean).sort();
  const kwCount = {};
  for (const r of store.records) {
    const arr = Array.isArray(r.keywords) ? r.keywords : [];
    for (const k of arr) { if (k && k !== '未提及') kwCount[k] = (kwCount[k] || 0) + 1; }
  }
  const kws = Object.entries(kwCount).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  const fill = (sel, list, prefix, cur) => {
    const el = $(sel);
    el.innerHTML = `<option value="all">${prefix}：全部</option>` + list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    el.value = list.includes(cur) ? cur : 'all';
  };
  fill('#f-year', years, '年份', filters.year);
  fill('#f-kw', kws, '关键词', filters.kw);
  filters.year = $('#f-year').value; filters.kw = $('#f-kw').value;
  $('#f-status').value = filters.status;
  const noFilter = filters.q === '' && filters.year === 'all' && filters.kw === 'all' && filters.status === 'all';
  $('#f-clear').disabled = noFilter;
}

export function initFilters() {
  $('#f-q').addEventListener('input', (e) => { store.filters.q = e.target.value.trim(); render(); });
  $('#f-year').addEventListener('change', (e) => { store.filters.year = e.target.value; render(); });
  $('#f-kw').addEventListener('change', (e) => { store.filters.kw = e.target.value; render(); });
  $('#f-status').addEventListener('change', (e) => { store.filters.status = e.target.value; render(); });
  $('#f-clear').addEventListener('click', () => {
    store.filters = { q: '', year: 'all', kw: 'all', status: 'all' };
    $('#f-q').value = '';
    render();
  });
}
