// arXiv / DOI 导入：始终浏览器直连（不依赖本地桥）
// 从旧 index.html 1645–1708 行迁移；这是 none.js 不误伤的关键前提
export function parseLink(raw) {
  const s = (raw || '').trim();
  let m = s.match(/arxiv\.org\/(?:abs|pdf)\/([^\s?#]+)/i) || s.match(/^arxiv[:：]\s*([^\s]+)/i);
  if (m) return { type: 'arxiv', id: m[1].replace(/\.pdf$/i, '') };
  m = s.match(/^(10\.\d{4,9}\/\S+)$/);
  if (m) return { type: 'doi', id: m[1].replace(/[.,;]$/, '') };
  return null;
}

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

// 浏览器直连 arXiv 下载 PDF
export async function fetchArxiv(id) {
  const r = await fetch('https://arxiv.org/pdf/' + encodeURIComponent(id), { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return {
    pdf_base64: bufToB64(await r.arrayBuffer()),
    filename: 'arXiv-' + id.replace('/', '_') + '.pdf',
  };
}

// 浏览器直连 Crossref 获取 DOI 元数据
export async function fetchDoi(id) {
  const r = await fetch('https://api.crossref.org/works/' + encodeURIComponent(id), { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const msg = (await r.json()).message;
  const yparts = (((msg.issued || {})['date-parts'] || [[]])[0]) || [];
  const authors = (msg.author || []).map((a) => [a.family, a.given].filter(Boolean).join(' ')).filter(Boolean);
  return {
    title: (msg.title && msg.title[0]) || '—',
    authors: authors.length ? authors : ['未提及'],
    year: String(yparts[0] || '—'),
  };
}

// 将 base64 PDF 转为 File 对象
export function pdfBase64ToFile(b64, filename) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new File([bytes], filename, { type: 'application/pdf' });
}
