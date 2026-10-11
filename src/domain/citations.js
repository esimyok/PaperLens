// 引用格式：GB/T 7714 与 APA（从旧 index.html 904–933 行迁移）
export function realAuthors(authors) {
  return (Array.isArray(authors) ? authors : []).filter((x) => x && x !== '未提及');
}

export function citeGBT(r) {
  const a = realAuthors(r.authors);
  const who = a.length ? (a.slice(0, 3).join(', ') + (a.length > 3 ? ', 等' : '')) : '佚名';
  const t = r.title && r.title !== '—' ? r.title : r.filename;
  const y = r.year && r.year !== '—' ? `${r.year}.` : '';
  return `${who}. ${t}[J]. ${y}`.trim();
}

function apaName(n) {
  n = String(n).trim();
  if (!n.includes(' ')) return n;
  const parts = n.split(/\s+/);
  const family = parts.pop();
  const given = parts.map((p) => p[0].toUpperCase() + '.').join('');
  return `${family}, ${given}`;
}

export function citeAPA(r) {
  const a = realAuthors(r.authors).map(apaName);
  let who;
  if (!a.length) who = '佚名';
  else if (a.length === 1) who = a[0];
  else if (a.length === 2) who = a.join(' & ');
  else who = a.join(', ');
  const y = r.year && r.year !== '—' ? `(${r.year}).` : '(n.d.).';
  const t = r.title && r.title !== '—' ? r.title : r.filename;
  return `${who} ${y} ${t}.`;
}
