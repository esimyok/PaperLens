// 桥选择：按 context.bridgeAvailable 在 http（Zotero）与 none（降级）间切换
import * as http from './http.js';
import * as none from './none.js';
import { context } from '../core/context.js';
import { store } from '../core/store.js';

export async function detectBridge() {
  try {
    const d = await http.ping();
    if (d && d.ok) {
      context.bridgeAvailable = true;
      store.bridgeAvailable = true;
      return true;
    }
  } catch (e) { /* 无服务 */ }
  context.bridgeAvailable = false;
  store.bridgeAvailable = false;
  return false;
}

export function getBridge() {
  return context.bridgeAvailable ? http : none;
}
