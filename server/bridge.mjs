// SiftLit 本地桥（Node）：Zotero 联动 + AI 同源转发
// 由 server/index.mjs（生产）与 vite.config.js 中间件（dev / preview）共用。
// 同源部署后页面与接口同源，浏览器不再触发 CORS；/ai 仍是「同源内部转发」。
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { PROVIDERS } from '../src/ai/providers.js';

const ZOTERO = 'http://127.0.0.1:23119';

// provider 主机白名单：与前端 ai/providers.js 同源，避免两处漂移
const ALLOWED_AI_HOSTS = new Set(Object.values(PROVIDERS).map((p) => new URL(p.base).host));

const FORWARD_HEADERS = [
  'content-type', 'accept', 'authorization', 'x-api-key',
  'anthropic-version', 'anthropic-dangerous-direct-browser-access',
];
const ALLOW_HEADERS = 'content-type,authorization,x-api-key,anthropic-version,anthropic-dangerous-direct-browser-access,accept';

// ---------------- 工具 ----------------
function corsHeaders(req) {
  const o = req && req.headers ? req.headers.origin : undefined;
  return o ? { 'Access-Control-Allow-Origin': o, Vary: 'Origin' } : {};
}

function sendJson(res, obj, status = 200) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    ...corsHeaders(res.req),
  });
  res.end(body);
}

// 只允许本机来源（Origin 缺省表示同源/非浏览器），防止异站借道
function originAllowed(req) {
  const o = req.headers.origin;
  if (o === undefined || o === 'null') return true;
  try {
    const h = new URL(o).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
  } catch {
    return false;
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function withTimeout(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

// ---------------- Zotero ----------------
async function postJson(url, payload, timeout = 10000) {
  const { signal, done } = withTimeout(timeout);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    const txt = await r.text();
    return txt.trim() ? JSON.parse(txt) : {};
  } finally {
    done();
  }
}

async function rpc(method, params) {
  const resp = await postJson(ZOTERO + '/better-bibtex/json-rpc', {
    jsonrpc: '2.0', method, params: params || [], id: 1,
  });
  if (resp && resp.error) throw new Error('BBT RPC 错误: ' + JSON.stringify(resp.error));
  return resp ? resp.result : undefined;
}

async function zoteroAlive() {
  const { signal, done } = withTimeout(3000);
  try {
    await fetch(ZOTERO + '/connector/ping', { signal });
    return true;
  } catch {
    return false;
  } finally {
    done();
  }
}

async function localApiGet(path, timeout = 15000) {
  const { signal, done } = withTimeout(timeout);
  try {
    const r = await fetch(ZOTERO + '/api/users/0' + path, { headers: { Accept: 'application/json' }, signal });
    if (!r.ok) {
      const e = new Error('HTTP ' + r.status);
      e.status = r.status;
      throw e;
    }
    return await r.json();
  } finally {
    done();
  }
}

// 附件 key -> (pdf Buffer, 文件名)。302 时从 Location 拿磁盘路径读取。
async function attachmentPdf(attKey) {
  const { signal, done } = withTimeout(30000);
  try {
    const r = await fetch(`${ZOTERO}/api/users/0/items/${attKey}/file`, { redirect: 'manual', signal });
    if (r.status === 200) {
      const buf = Buffer.from(await r.arrayBuffer());
      return buf.subarray(0, 4).toString('latin1') === '%PDF' ? { buf, name: null } : { buf: null, name: null };
    }
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const loc = r.headers.get('location') || '';
      if (loc.startsWith('file:')) {
        let p = decodeURIComponent(new URL(loc).pathname);
        if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1); // Windows: /C:/... -> C:/...
        try {
          return { buf: await readFile(p), name: basename(p) };
        } catch {
          return { buf: null, name: null };
        }
      }
    }
    return { buf: null, name: null };
  } catch {
    return { buf: null, name: null };
  } finally {
    done();
  }
}

function authorsFromCreators(creators) {
  const out = [];
  for (const c of creators || []) {
    if (!c || typeof c !== 'object') continue;
    if (c.name) { out.push(c.name); continue; }
    const full = `${c.lastName || ''} ${c.firstName || ''}`.trim();
    if (full) out.push(full);
  }
  return out;
}

async function getSelected() {
  if (!(await zoteroAlive())) return { error: 'zotero_offline' };
  try {
    await rpc('api.ready');
  } catch {
    return { error: 'bbt_missing' };
  }
  let mapping;
  try {
    mapping = (await rpc('item.citationkey', ['selected'])) || {};
  } catch (e) {
    return { error: 'rpc_fail', detail: String((e && e.message) || e) };
  }
  if (!mapping || Object.keys(mapping).length === 0) return { error: 'no_selection' };
  const itemKey = Object.keys(mapping)[0];
  const citekey = mapping[itemKey];
  if (!/^[A-Z0-9]{8}$/.test(String(itemKey))) return { error: 'bad_key', detail: String(itemKey) };

  let item;
  try {
    item = await localApiGet(`/items/${itemKey}?format=json`);
  } catch (e) {
    if (e.status === 403) return { error: 'local_api_disabled' };
    return { error: 'api_fail', detail: String((e && e.message) || e) };
  }
  let data = (item && item.data) || {};
  let pdfKey = null;
  let filename = null;
  if (data.itemType === 'attachment') {
    if (String(data.contentType || '').toLowerCase() === 'application/pdf' ||
        String(data.filename || '').toLowerCase().endsWith('.pdf')) {
      pdfKey = itemKey;
      filename = data.filename || (itemKey + '.pdf');
    }
    const parent = data.parentItem;
    if (parent) {
      try { data = ((await localApiGet(`/items/${parent}?format=json`)) || {}).data || {}; } catch { /* ignore */ }
    }
  }
  const title = data.title || data.name || citekey || itemKey;
  let year = '';
  const m = /\d{4}/.exec(String(data.date || ''));
  if (m) year = m[0];
  if (!pdfKey) {
    try {
      const children = await localApiGet(`/items/${itemKey}/children?format=json`);
      for (const ch of children || []) {
        const d = ch.data || {};
        const ct = String(d.contentType || '').toLowerCase();
        const fn = String(d.filename || d.path || '').toLowerCase();
        if (ct === 'application/pdf' || fn.endsWith('.pdf')) {
          pdfKey = ch.key;
          filename = d.filename || (title + '.pdf');
          break;
        }
      }
    } catch { /* ignore */ }
  }
  const out = { key: itemKey, citekey: citekey || itemKey, title, authors: authorsFromCreators(data.creators), year };
  if (!pdfKey) { out.error = 'no_pdf'; return out; }
  const { buf, name } = await attachmentPdf(pdfKey);
  if (!buf) { out.error = 'no_pdf'; return out; }
  out.filename = filename || name || (out.citekey + '.pdf');
  out.pdf_base64 = buf.toString('base64');
  return out;
}

// ---------------- AI 同源转发 ----------------
async function forwardAI(req, res, path, query) {
  const rest = path.slice('/ai/'.length);
  const host = rest.split('/')[0];
  if (!ALLOWED_AI_HOSTS.has(host)) {
    return sendJson(res, { error: 'forbidden', detail: 'host not allowed: ' + host }, 403);
  }
  const target = `https://${rest}${query ? '?' + query : ''}`;
  const body = await readBody(req);
  const headers = { 'User-Agent': 'SiftLit-bridge/1.0' };
  for (const h of FORWARD_HEADERS) {
    const v = req.headers[h];
    if (v !== undefined) headers[h] = Array.isArray(v) ? v.join(',') : v;
  }
  const { signal, done } = withTimeout(120000);
  let status, ctype, buf;
  try {
    const r = await fetch(target, { method: 'POST', headers, body: body.length ? body : undefined, signal });
    status = r.status;
    ctype = r.headers.get('content-type') || 'application/json';
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    done();
    return sendJson(res, { error: 'api_fail', detail: String((e && e.message) || e) }, 502);
  }
  done();
  res.writeHead(status, { 'Content-Type': ctype, 'Content-Length': buf.length, ...corsHeaders(req) });
  res.end(buf);
}

// ---------------- 对外：统一入口 ----------------
// 返回 true 表示已处理（已写出响应），false 表示不是桥的路径、交给后续中间件
export async function handleBridge(req, res) {
  const u = new URL(req.url, 'http://localhost');
  const path = u.pathname;
  const isBridge = path === '/ping' || path === '/selected' || path.startsWith('/ai/');
  if (!isBridge) return false;

  try {
    if (!originAllowed(req)) { sendJson(res, { error: 'forbidden' }, 403); return true; }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...corsHeaders(req),
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': ALLOW_HEADERS,
        'Access-Control-Max-Age': '600',
        'Content-Length': 0,
      });
      res.end();
      return true;
    }
    if (path === '/ping' && req.method === 'GET') {
      const alive = await zoteroAlive();
      let bbt = false;
      if (alive) { try { await rpc('api.ready'); bbt = true; } catch { /* ignore */ } }
      sendJson(res, { ok: true, zotero: alive, bbt });
      return true;
    }
    if (path === '/selected' && req.method === 'GET') {
      sendJson(res, await getSelected());
      return true;
    }
    if (path.startsWith('/ai/') && req.method === 'POST') {
      await forwardAI(req, res, path, u.search ? u.search.slice(1) : '');
      return true;
    }
    sendJson(res, { error: 'not_found' }, 404);
    return true;
  } catch (e) {
    if (!res.headersSent) sendJson(res, { error: 'server_fail', detail: String((e && e.message) || e) }, 500);
    else res.end();
    return true;
  }
}

export { ALLOWED_AI_HOSTS };
