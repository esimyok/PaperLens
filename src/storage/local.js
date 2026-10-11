// localStorage 存储层（保留旧键名 paperlens_*，不迁移旧数据）
export const LS_RECORDS = 'paperlens_records';
export const LS_SETTINGS = 'paperlens_settings';

export const DEFAULT_SETTINGS = {
  provider: 'glm',
  providers: {},        // { glm:{key,model}, ... }
  zotero: true,
  hiddenCols: ['data_and_sample', 'innovation', 'limitations'],
  theme: 'light',
  rowCols: { keywords: true, summary: true, subline: true },
};

export function loadRecordsRaw() {
  try { return JSON.parse(localStorage.getItem(LS_RECORDS)) || []; }
  catch (e) { return []; }
}

// 写时剥离 text（全文存 IndexedDB，避免 localStorage 触顶）
export function saveRecordsRaw(records) {
  const slim = records.map(({ text, ...rest }) => rest);
  try {
    localStorage.setItem(LS_RECORDS, JSON.stringify(slim));
  } catch (e) {
    // 配额超限：上层 toast 提示
    throw new Error('localStorage 存储空间不足，表格数据可能未保存');
  }
}

export function loadSettingsRaw() {
  try { return JSON.parse(localStorage.getItem(LS_SETTINGS)) || {}; }
  catch (e) { return {}; }
}

export function saveSettingsRaw(settings) {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
}

// 兼容旧版：apiKey / model 扁平字段 → providers[provider]
export function migrateSettings(s) {
  const settings = { ...DEFAULT_SETTINGS, ...(s || {}) };
  if (settings.apiKey && !(settings.providers && settings.providers.glm)) {
    settings.providers = settings.providers || {};
    settings.providers.glm = { key: settings.apiKey, model: settings.model || 'glm-4-flash-250414' };
  }
  settings.provider = settings.provider || 'glm';
  settings.providers = settings.providers || {};
  settings.hiddenCols = Array.isArray(settings.hiddenCols) ? settings.hiddenCols : DEFAULT_SETTINGS.hiddenCols;
  settings.rowCols = { ...DEFAULT_SETTINGS.rowCols, ...(settings.rowCols || {}) };
  return settings;
}
