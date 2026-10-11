// IndexedDB：PDF 全文存储（替代旧 index.html 的 idb* 全局函数）
const DB = 'paperlens';
const STORE = 'texts';
const VERSION = 1;
let dbp = null;

export function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const q = indexedDB.open(DB, VERSION);
    q.onupgradeneeded = () => {
      if (!q.result.objectStoreNames.contains(STORE)) q.result.createObjectStore(STORE);
    };
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
  return dbp;
}

function run(mode, fn) {
  return openDb().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}

export function setText(k, v) { return run('readwrite', (s) => s.put(v, k)); }
export function getText(k) { return run('readonly', (s) => s.get(k)); }
export function removeText(k) { return run('readwrite', (s) => s.delete(k)); }
export function clearText() { return run('readwrite', (s) => s.clear()); }
export function getAllKeys() { return run('readonly', (s) => s.getAllKeys()); }
