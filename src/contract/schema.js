// 记录 / 备份 / 设置的轻量校验
// 校验目的是尽早发现坏数据，不追求覆盖全部业务规则
import { AI_FIELDS, DETAIL_FIELDS } from './fields.js';

const STATUS_SET = new Set(['parsing', 'ai', 'done', 'fail']);

export function validateRecord(rec) {
  if (!rec || typeof rec !== 'object') return { ok: false, error: '记录不是对象' };
  if (typeof rec.id !== 'string' || !rec.id) return { ok: false, error: '缺少 id' };
  if (rec.status !== undefined && !STATUS_SET.has(rec.status)) {
    return { ok: false, error: `未知 status: ${rec.status}` };
  }
  for (const f of AI_FIELDS) {
    if (f === 'authors' || f === 'keywords') {
      if (rec[f] !== undefined && !Array.isArray(rec[f])) {
        return { ok: false, error: `字段 ${f} 应为数组` };
      }
    }
  }
  return { ok: true };
}

export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: '备份不是对象' };
  if (!Array.isArray(obj.records)) return { ok: false, error: 'records 缺失或非数组' };
  for (const r of obj.records) {
    const v = validateRecord(r);
    if (!v.ok) return { ok: false, error: `记录校验失败: ${v.error}` };
  }
  return { ok: true };
}

export function validateSettings(settings) {
  if (!settings || typeof settings !== 'object') return { ok: false, error: '设置不是对象' };
  if (settings.provider !== undefined && typeof settings.provider !== 'string') {
    return { ok: false, error: 'provider 应为字符串' };
  }
  if (settings.hiddenCols !== undefined && !Array.isArray(settings.hiddenCols)) {
    return { ok: false, error: 'hiddenCols 应为数组' };
  }
  if (settings.theme !== undefined && !['light', 'dark'].includes(settings.theme)) {
    return { ok: false, error: 'theme 非法' };
  }
  if (settings.hiddenCols) {
    const bad = settings.hiddenCols.find((c) => !DETAIL_FIELDS.includes(c));
    if (bad) return { ok: false, error: `hiddenCols 含非法字段: ${bad}` };
  }
  return { ok: true };
}
