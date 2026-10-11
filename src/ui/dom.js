// DOM 工具：$ / esc / raw / html`` / mdRender（原版完整版）/ toast / copyText / 下拉菜单
// html`` 模板：插值默认转义；raw(x) 原样插入

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function raw(s) {
  return { __html: String(s ?? '') };
}

export function html(parts, ...vals) {
  return parts.reduce((acc, p, i) => {
    const v = i < vals.length ? vals[i] : '';
    const piece = (v && typeof v === 'object' && v.__html !== undefined) ? v.__html : esc(v);
    return acc + p + piece;
  }, '');
}

/* ---------- Toast ---------- */
export function toast(msg, type = '', ms) {
  const box = $('#toast-box');
  if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const ic = type === 'ok' ? 'i-check-c' : type === 'err' ? 'i-alert' : type === 'warn' ? 'i-alert' : 'i-info';
  t.innerHTML = `<svg class="icon sm ticon"><use href="#${ic}"/></svg><span>${esc(msg)}</span><button class="tclose"><svg class="icon sm"><use href="#i-close"/></svg></button>`;
  t.querySelector('.tclose').addEventListener('click', () => t.remove());
  box.appendChild(t);
  if (type !== 'err') {
    const wait = ms || (type === 'warn' ? 5000 : 3000);
    setTimeout(() => t.remove(), wait);
  }
}

/* ---------- 复制 ---------- */
export async function copyText(t, msg) {
  try { await navigator.clipboard.writeText(t); }
  catch (e) {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  toast(msg || '已复制到剪贴板', 'ok');
}

/* ---------- 下拉菜单 ---------- */
export const menuEl = () => $('#menu');
export function openMenu(anchor, items, stayOpen = false) {
  const m = menuEl();
  m.innerHTML = '';
  for (const it of items) {
    if (it.sep) { const s = document.createElement('div'); s.className = 'msep'; m.appendChild(s); continue; }
    if (it.title) { const g = document.createElement('div'); g.className = 'mgroup'; g.textContent = it.title; m.appendChild(g); continue; }
    const b = document.createElement('button');
    b.textContent = it.label;
    b.addEventListener('click', () => { if (!stayOpen) m.hidden = true; it.action(); });
    m.appendChild(b);
  }
  m.hidden = false;
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8) + 'px';
}
export function initMenuDismiss() {
  document.addEventListener('click', (e) => {
    const m = menuEl();
    if (!m.hidden && !m.contains(e.target)) m.hidden = true;
  }, true);
}

/* ---------- Markdown 渲染（原版 1295–1324 行） ---------- */
function inlineMd(s) {
  return s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/__([^_]+)__/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<i>$2</i>');
}

export function mdRender(src) {
  let s = esc(src);
  const blocks = [];
  s = s.replace(/```([\s\S]*?)```/g, (_, c) => { blocks.push(c.replace(/^\w*\n/, '')); return '\u0000B' + (blocks.length - 1) + '\u0000'; });
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return '\u0000C' + (codes.length - 1) + '\u0000'; });
  const lines = s.split('\n');
  let out = '', inUl = false, inOl = false;
  const closeLists = () => { if (inUl) { out += '</ul>'; inUl = false; } if (inOl) { out += '</ol>'; inOl = false; } };
  for (const ln of lines) {
    const bp = ln.match(/^\u0000B(\d+)\u0000$/);
    if (bp) { closeLists(); out += `\u0000B${bp[1]}\u0000`; continue; }
    const h = ln.match(/^(#{1,4})\s+(.*)/);
    const ul = ln.match(/^\s*[-*•]\s+(.+)/);
    const ol = ln.match(/^\s*(\d+)[.、)）]\s+(.+)/);
    if (h) { closeLists(); out += `<h4>${inlineMd(h[2])}</h4>`; }
    else if (ul) { if (inOl) { out += '</ol>'; inOl = false; } if (!inUl) { out += '<ul>'; inUl = true; } out += `<li>${inlineMd(ul[1])}</li>`; }
    else if (ol) { if (inUl) { out += '</ul>'; inUl = false; } if (!inOl) { out += '<ol>'; inOl = true; } out += `<li>${inlineMd(ol[2])}</li>`; }
    else if (ln.trim() === '') { closeLists(); }
    else { closeLists(); out += `<p>${inlineMd(ln)}</p>`; }
  }
  closeLists();
  return out.replace(/\u0000B(\d+)\u0000/g, (_, i) => `<pre class="codeblock"><code>${blocks[+i]}</code></pre>`)
    .replace(/\u0000C(\d+)\u0000/g, (_, i) => `<code class="inlinecode">${codes[+i]}</code>`);
}
