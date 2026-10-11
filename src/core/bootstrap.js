// 启动：加载数据 → 迁移/恢复中断 → 载入全文 → 应用主题 → 探测桥
import { store, notify } from './store.js';
import * as storage from '../storage/index.js';
import { detectBridge } from '../bridge/index.js';

export function applyTheme() {
  const dark = store.settings.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : '';
}

export async function boot() {
  // 1. 载入设置 + 记录（含 apiKey→providers 迁移、中断恢复、IndexedDB 全文）
  const { settings, records, textCache } = await storage.loadAll();
  store.settings = settings;
  store.records = records;
  store.textCache = textCache;
  // 把全文回填到记录（问答 / 重新分析需要 rec.text；写 localStorage 时仍会被剥离）
  for (const r of store.records) r.text = textCache[r.id] || '';

  // 2. 主题
  applyTheme();

  // 3. 全局错误兜底
  window.addEventListener('error', (e) => {
    store.toast('页面脚本出错：' + (e.message || '未知') + ' —— 请到 github 反馈', 'err');
  });

  // 4. 探测本地桥（同源 /ping；Zotero 联动依赖它）
  await detectBridge();

  // 5. 通知首屏渲染
  notify();
  return { settings, records };
}
