// 通用小工具（不在原方案目录树中显式列出，但被多处复用，单独成文件避免污染 store）
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 安全解析 JSON，失败返回 null
export function safeJson(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}
