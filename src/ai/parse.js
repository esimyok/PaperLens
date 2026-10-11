// AI 响应解析 + 文本截断（从旧 index.html 651–775 行迁移）
import { AI_FIELDS, NOT_MENTIONED } from '../contract/fields.js';

export function extractJsonText(raw) {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}

export function truncateText(t, cap = 60000) {
  if (t.length <= cap) return t;
  const head = Math.floor(cap * 0.8);
  const tail = cap - head;
  return t.slice(0, head) + '\n\n……[中间内容已截断]……\n\n' + t.slice(-tail);
}

// 把任意 JSON 对象规范化为固定 11 字段（数组字段智能拆分，空值填「未提及」）
export function normalizeJson(obj) {
  const out = {};
  for (const f of AI_FIELDS) {
    let v = obj ? obj[f] : undefined;
    if (f === 'authors' || f === 'keywords') {
      if (typeof v === 'string') v = v.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean);
      if (!Array.isArray(v)) v = [];
      v = v.map((x) => String(x).trim()).filter(Boolean);
      out[f] = v.length ? v : [NOT_MENTIONED];
    } else {
      v = (v === undefined || v === null || v === '') ? NOT_MENTIONED : String(v).trim();
      out[f] = v || NOT_MENTIONED;
    }
  }
  return out;
}
