// 无桥降级：Zotero 相关全部返回 no_bridge；不影响 arXiv / DOI（它们在 domain/sources.js 直连）
export async function ping() {
  return { ok: false };
}

export async function getSelected() {
  return { error: 'no_bridge' };
}
