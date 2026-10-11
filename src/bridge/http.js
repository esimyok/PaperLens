// 桥（同源）：dev 由 vite bridgePlugin、生产由 server/index.mjs 提供 /ping /selected
// 同源后无需跨域，直接走相对路径。
const BASE = '';

export async function ping() {
  const r = await fetch(BASE + '/ping', { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export async function getSelected() {
  const r = await fetch(BASE + '/selected', { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
