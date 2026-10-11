// 文献问答抽屉 + 行选择（原版 1110–1147 / 1294–1447 行）
import { store, persistSettings } from '../core/store.js';
import { $, esc, mdRender, toast } from './dom.js';
import { PROVIDERS, CHAT_PROMPT, CHAT_PROMPT_MULTI, MAX_CHARS, getProviderCfg } from '../ai/providers.js';
import { callAIWithRetry } from '../ai/client.js';
import { truncateText } from '../ai/parse.js';

/* ---------- 选择 ---------- */
export function selectedRecords() {
  return [...store.selectedIds].map((x) => store.records.find((r) => r.id === x)).filter(Boolean);
}

export function rowClick(id, additive) {
  const sel = store.selectedIds;
  if (additive) {
    if (sel.has(id)) sel.delete(id); else sel.add(id);
    if (sel.size === 0) sel.add(id);
  } else {
    sel.clear();
    sel.add(id);
  }
  store.selectedId = id;
  document.querySelectorAll('.row').forEach((r) => r.classList.toggle('selected', sel.has(r.dataset.id)));
  const recs = selectedRecords();
  $('#chat-paper').textContent = recs.length === 1
    ? `当前文献：${recs[0].title && recs[0].title !== '—' ? recs[0].title : recs[0].filename}`
    : `已选 ${recs.length} 篇合并问答：${recs.slice(0, 3).map((r) => r.title || r.filename).join('、')}${recs.length > 3 ? '…' : ''}`;
  document.body.classList.add('chat-open');
  updateChatBadge();
  renderChat();
}

export function updateChatBadge() {
  const n = store.selectedIds.size;
  const b = $('#chat-badge');
  b.hidden = n === 0;
  b.textContent = n;
}

/* ---------- 渲染 ---------- */
function msgHtml(m) {
  if (m.role === 'user') return esc(m.content);
  return '<div class="msg ai md">' + (m.content.startsWith('❌') ? esc(m.content) : mdRender(m.content)) + '</div>';
}

function chatKey() {
  const recs = selectedRecords();
  if (!recs.length) return null;
  return recs.length === 1 ? recs[0].id : recs.map((r) => r.id).sort().join('|');
}

export function renderChat() {
  const box = $('#chat-msgs');
  const hkey = chatKey();
  const hist = hkey ? (store.chatHistories[hkey] || []) : [];
  if (!hkey || hist.length === 0) {
    box.innerHTML = `<div class="chat-empty">点击表格任意一行选中文献<br>Ctrl+点击可多选合并问答<br><br>例如："这篇论文的创新点是什么？"<br>"这两篇文献的方法有什么异同？"</div>`;
    return;
  }
  box.innerHTML = hist.map(msgHtml).join('');
  box.scrollTop = box.scrollHeight;
}

export function toggleChat(open) {
  const willOpen = open === undefined ? !document.body.classList.contains('chat-open') : open;
  document.body.classList.toggle('chat-open', willOpen);
  $('#btn-chat-label').textContent = willOpen ? '收起问答' : '问答';
  $('#btn-chat').classList.toggle('active', willOpen);
  if (willOpen) refreshChatModelBar();
}

/* ---------- 发送 ---------- */
async function sendChat() {
  if (store.chatBusy) return;
  const recs = selectedRecords();
  if (!recs.length) { toast('请先点击表格中的一行文献（Ctrl+点击可多选），再提问', 'warn'); return; }
  const inp = $('#chat-in');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  const hkey = chatKey();
  const hist = store.chatHistories[hkey] = store.chatHistories[hkey] || [];
  hist.push({ role: 'user', content: text });
  renderChat();
  store.chatBusy = true;
  const box = $('#chat-msgs');
  const think = document.createElement('div');
  think.className = 'msg ai thinking';
  think.innerHTML = `<span class="dots"><i></i><i></i><i></i></span><span>正在阅读所选 ${recs.length === 1 ? '' : recs.length + ' 篇'}文献…</span>`;
  box.appendChild(think); box.scrollTop = box.scrollHeight;
  const bodyOf = (r) => r.text || store.textCache[r.id] || '';
  try {
    let system;
    if (recs.length === 1) {
      const r = recs[0];
      const context = bodyOf(r)
        ? truncateText(bodyOf(r))
        : `（未提取到全文，仅有元数据）标题：${r.title}；作者：${Array.isArray(r.authors) ? r.authors.join(', ') : r.authors}；年份：${r.year}`;
      system = CHAT_PROMPT + context + '\n===================';
    } else {
      const per = Math.max(8000, Math.floor(MAX_CHARS / recs.length));
      const context = recs.map((r, i) => {
        const b = bodyOf(r);
        const body = b ? truncateText(b, per)
          : `（未提取到全文，仅有元数据）标题：${r.title}；作者：${Array.isArray(r.authors) ? r.authors.join(', ') : r.authors}；年份：${r.year}`;
        return `【文献 ${i + 1}】${r.title && r.title !== '—' ? r.title : r.filename}${r.year && r.year !== '—' ? '（' + r.year + '）' : ''}\n${body}`;
      }).join('\n\n');
      system = CHAT_PROMPT_MULTI + context + '\n===================';
    }
    const messages = [
      { role: 'system', content: system },
      ...hist.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    ];
    const answer = await callAIWithRetry(messages, store.settings, { json: false });
    hist.push({ role: 'assistant', content: answer });
  } catch (err) {
    hist.push({ role: 'assistant', content: '❌ 请求失败：' + err.message });
  } finally {
    store.chatBusy = false;
    renderChat();
  }
}

/* ---------- 对话栏模型切换 ---------- */
function fillChatModelOptions() {
  const pid = store.settings.provider || 'glm';
  const saved = store.settings.providers[pid] || {};
  const cur = saved.model || PROVIDERS[pid].models[0];
  const inp = $('#chat-model');
  inp.value = cur;
  $('#chat-model-list').innerHTML = PROVIDERS[pid].models.map((m) => `<option value="${esc(m)}">`).join('');
  inp.title = saved.key ? '模型名可直接手动输入，回车或点空白处保存' : '尚未配置该服务商的 API Key，可先输入模型名';
}

export function refreshChatModelBar() {
  $('#chat-provider').innerHTML = Object.entries(PROVIDERS)
    .map(([id, p]) => `<option value="${id}" ${id === (store.settings.provider || 'glm') ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  fillChatModelOptions();
}

function commitChatModel() {
  const pid = store.settings.provider || 'glm';
  const val = $('#chat-model').value.trim();
  if (!val) { fillChatModelOptions(); return; }
  if ((store.settings.providers[pid] || {}).model === val) return;
  store.settings.providers[pid] = store.settings.providers[pid] || {};
  store.settings.providers[pid].model = val;
  persistSettings();
  toast('模型已保存：' + val, 'ok', 2000);
}

export function initChat() {
  $('#btn-chat').addEventListener('click', () => toggleChat());
  $('#chat-close').addEventListener('click', () => toggleChat(false));
  $('#chat-clear').addEventListener('click', () => {
    const k = chatKey();
    if (k) { store.chatHistories[k] = []; renderChat(); }
  });
  $('#chat-send').addEventListener('click', sendChat);
  $('#chat-in').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  $('#chat-provider').addEventListener('change', (e) => {
    store.settings.provider = e.target.value;
    persistSettings();
    fillChatModelOptions();
    const c = getProviderCfg(store.settings);
    toast(c.key ? `已切换到 ${c.name} · ${c.model}` : `已切换到 ${c.name}，但尚未配置 API Key，请点「管理」`, c.key ? 'ok' : 'warn', 4000);
  });
  $('#chat-model').addEventListener('change', commitChatModel);
  $('#chat-model').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  });
  $('#chat-manage').addEventListener('click', () => $('#btn-settings').click());
}
