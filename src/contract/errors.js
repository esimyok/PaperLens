// 错误码枚举：服务端（本地桥 server/bridge.mjs / Zotero）与客户端（浏览器）两类
// 从方案 §5 contract/errors.js 定义迁移

// 服务端错误码（由本地桥 server/bridge.mjs 返回）
export const SERVER_ERRORS = {
  ZOTERO_OFFLINE: 'zotero_offline',
  BBT_MISSING: 'bbt_missing',
  RPC_FAIL: 'rpc_fail',
  NO_SELECTION: 'no_selection',
  BAD_KEY: 'bad_key',
  LOCAL_API_DISABLED: 'local_api_disabled',
  API_FAIL: 'api_fail',
  NO_PDF: 'no_pdf',
  BAD_ID: 'bad_id',
  FETCH_FAIL: 'fetch_fail',
  NOT_PDF: 'not_pdf',
  FORBIDDEN: 'forbidden',
  INDEX_MISSING: 'index_missing',
  NOT_FOUND: 'not_found',
  SERVER_FAIL: 'server_fail',
};

// 客户端错误码（浏览器侧）
export const CLIENT_ERRORS = {
  NO_BRIDGE: 'no_bridge',
  CORS: 'cors',
  KEY_INVALID: 'key_invalid',
  RATE_LIMIT: 'rate_limit',
  ABORTED: 'aborted',
  OCR_FAIL: 'ocr_fail',
};

export const ERROR_CODES = { ...SERVER_ERRORS, ...CLIENT_ERRORS };

// 类型化错误，便于上层按 code 区分处理
export class AppError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    Object.assign(this, extra);
  }
}
