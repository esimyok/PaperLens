// 统计面板（原版 1557–1594 行）
import { store } from '../core/store.js';
import { $, esc, toast } from './dom.js';

function barList(pairs) {
  const max = Math.max(1, ...pairs.map((p) => p[1]));
  return pairs.map(([k, n]) => `<div class="bar-row"><span class="bar-label" title="${esc(k)}">${esc(k)}</span><div class="bar-track"><div class="bar ${n === max ? 'top' : ''}" style="width:${Math.round(n / max * 100)}%"></div></div><span class="bar-num">${n}</span></div>`).join('');
}

export function initStats() {
  $('#btn-stats').addEventListener('click', () => {
    if (store.records.length === 0) { toast('暂无数据，先导入几篇文献再看统计', 'warn'); return; }
    const done = store.records.filter((r) => r.status === 'done').length;
    const fail = store.records.filter((r) => r.status === 'fail').length;
    const translated = store.records.filter((r) => r.title_zh || r.summary_zh || r.findings_zh || r.rq_zh || r.method_zh).length;
    const chips = `<div class="stat-chips">
    <div class="chip"><b class="num">${store.records.length}</b><span>共有</span></div>
    <div class="chip"><b class="num">${done}</b><span>完成</span></div>
    <div class="chip"><b class="num">${fail}</b><span>失败</span></div>
    <div class="chip"><b class="num">${translated}</b><span>已翻译</span></div></div>`;
    const yearCount = {};
    for (const r of store.records) {
      const y = (r.year && r.year !== '—' && r.year !== '未提及') ? String(r.year) : '未知';
      yearCount[y] = (yearCount[y] || 0) + 1;
    }
    const yearPairs = Object.entries(yearCount).sort((a, b) => {
      const na = /^\d{4}$/.test(a[0]) ? +a[0] : Infinity;
      const nb = /^\d{4}$/.test(b[0]) ? +b[0] : Infinity;
      return na - nb;
    });
    const kwCount = {};
    for (const r of store.records) {
      const arr = Array.isArray(r.keywords) ? r.keywords : [];
      for (const k of arr) { if (k && k !== '未提及') kwCount[k] = (kwCount[k] || 0) + 1; }
    }
    const kwPairs = Object.entries(kwCount).sort((a, b) => b[1] - a[1]).slice(0, 12);
    $('#stats-body').innerHTML = chips
      + `<div class="stats-section">年份分布</div>${barList(yearPairs)}`
      + `<div class="stats-section">高频关键词（前 ${kwPairs.length}）</div>${barList(kwPairs)}`;
    $('#stats-mask').classList.add('show');
  });
  $('#btn-stats-close').addEventListener('click', () => $('#stats-mask').classList.remove('show'));
  $('#stats-mask').addEventListener('click', (e) => { if (e.target.id === 'stats-mask') $('#stats-mask').classList.remove('show'); });
}
