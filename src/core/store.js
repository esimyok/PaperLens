// 集中状态 + 轻量订阅（替代旧 index.html 散落的全局变量与 render()）
import * as storage from '../storage/index.js';

export const store = {
  records: [],
  settings: {},
  busy: false,
  selectedId: null,                 // 当前主选中（rowClick / del 使用）
  selectedIds: new Set(),           // Ctrl 多选
  filters: { q: '', year: 'all', kw: 'all', status: 'all' },
  chatHistories: {},
  chatBusy: false,
  textCache: {},                    // id -> PDF 全文（内存镜像，持久化在 IndexedDB）
  expandedIds: new Set(),           // 明细区展开的行
  detailAllIds: new Set(),          // 显示全部明细字段（含被收起的）
  deleteArm: new Map(),             // id -> timer（二次确认删除）
  bridgeAvailable: false,           // 替代原 proxyMode 概念
  toast: () => {},                  // 由 ui/shell 注入，避免 store 依赖 ui
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notify() {
  for (const fn of listeners) fn();
}

/* ---------- 持久化 ---------- */
export function persistRecords() { storage.saveRecords(store.records); }
export function persistSettings() { storage.saveSettings(store.settings); }

/* ---------- 全文（IndexedDB 镜像） ---------- */
export function setText(rec, text) {
  rec.text = text;
  store.textCache[rec.id] = text;
  storage.setText(rec.id, text);
}
export function getText(id) { return store.textCache[id] || ''; }

/* ---------- 记录集合操作 ---------- */
export function addRecord(rec) {
  store.records.unshift(rec);
  persistRecords();
}
export function getRecord(id) {
  return store.records.find((r) => r.id === id) || null;
}
export function updateRecord(id, patch) {
  const rec = getRecord(id);
  if (rec) Object.assign(rec, patch);
  return rec;
}
export function removeRecord(id) {
  const i = store.records.findIndex((r) => r.id === id);
  if (i >= 0) {
    store.records.splice(i, 1);
    persistRecords();
    storage.removeText(id);
    delete store.textCache[id];
    store.selectedIds.delete(id);
    store.expandedIds.delete(id);
    store.detailAllIds.delete(id);
  }
}

/* ---------- 选中 ---------- */
export function toggleSelected(id) {
  if (store.selectedIds.has(id)) store.selectedIds.delete(id);
  else store.selectedIds.add(id);
  store.selectedId = id;
}
export function clearSelected() {
  store.selectedIds.clear();
  store.selectedId = null;
}
