// 统一存储入口（localStorage + IndexedDB），键名保留 paperlens_*
import {
  loadRecordsRaw, saveRecordsRaw, loadSettingsRaw, saveSettingsRaw, migrateSettings,
} from './local.js';
import { getText as idbGet, setText as idbSet, removeText as idbDel, clearText as idbClear, openDb, getAllKeys } from './idb.js';

// 启动时一次性载入：设置（含迁移）、记录（含中断恢复）、IndexedDB 全文
export async function loadAll() {
  const settings = migrateSettings(loadSettingsRaw());
  const records = loadRecordsRaw();

  // 恢复被中断的分析任务
  let interrupted = false;
  for (const r of records) {
    if (r.status === 'parsing' || r.status === 'ai') {
      r.status = 'fail';
      r.statusText = '已中断';
      r.errMsg = '上次分析未完成（页面被关闭），可点「重新分析」继续';
      interrupted = true;
    }
  }
  if (interrupted) saveRecordsRaw(records);

  // 全文：优先用记录内联 text，否则从 IndexedDB 读取
  const textCache = {};
  try {
    await openDb();
    for (const r of records) {
      if (typeof r.text === 'string' && r.text) {
        textCache[r.id] = r.text;
        try { await idbSet(r.id, r.text); } catch (e) { /* ignore */ }
        delete r.text;
      } else {
        textCache[r.id] = (await idbGet(r.id)) || '';
      }
    }
    saveRecordsRaw(records);
  } catch (e) { /* IndexedDB 不可用时退化为无全文 */ }

  return { settings, records, textCache };
}

export function saveRecords(records) { saveRecordsRaw(records); }
export function saveSettings(settings) { saveSettingsRaw(settings); }
export function setText(id, text) { return idbSet(id, text); }
export function removeText(id) { return idbDel(id); }
export function clearText() { return idbClear(); }
export function getTextById(id) { return idbGet(id); }
