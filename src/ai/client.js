// AI 客户端：超时 + AbortController + 类型化错误
// 有本地服务（同源）时统一经 /ai/<host> 转发；否则浏览器直连（可能被 CORS 拦）
import { context } from '../core/context.js';
import { getProviderCfg } from './providers.js';
import { AppError } from '../contract/errors.js';
import { sleep } from '../core/util.js';

// 单次请求；viaBridge=true 时走同源 /ai/<host> 转发（host 白名单在 server/bridge.mjs 端）
export async function callAIOnce(messages, json, settings, viaBridge) {
  const cfg = getProviderCfg(settings);
  if (!cfg.key) {
    throw new AppError('key_invalid', cfg.name + ' 未配置 API Key，请点右上角「设置」填写');
  }
  const host = cfg.base.replace(/^https?:\/\//, '');
  const base = viaBridge ? (context.bridgeBase + '/ai/' + host) : cfg.base;

  let url, headers, body, parse;
  if (cfg.style === 'anthropic') {
    url = base + '/messages';
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': cfg.key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    body = {
      model: cfg.model,
      max_tokens: 4000,
      temperature: 0.2,
      system: (messages.find((m) => m.role === 'system') || {}).content || '',
      messages: messages.filter((m) => m.role !== 'system'),
    };
    parse = (d) => (d.content && d.content[0] && d.content[0].text) || '';
  } else {
    url = base + '/chat/completions';
    headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key };
    body = { model: cfg.model, temperature: 0.2, messages };
    if (json && cfg.json) body.response_format = { type: 'json_object' };
    parse = (d) => (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), context.aiTimeout);
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
  } catch (e) {
    clearTimeout(timer);
    // TypeError = 网络/CORS 等；交由 callAI 决定是否走桥兜底
    throw e;
  }
  clearTimeout(timer);

  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = (j.error && j.error.message) || j.message || ''; } catch (e) { /* ignore */ }
    if (res.status === 401 || res.status === 403) {
      throw new AppError('key_invalid', cfg.name + ' API Key 无效或无权限（' + res.status + '）' + (detail ? '：' + detail : ''));
    }
    if (res.status === 429) {
      throw new AppError('rate_limit', cfg.name + ' 请求过于频繁（429），请稍后重试' + (detail ? '：' + detail : ''));
    }
    throw new AppError('api_fail', cfg.name + ' 返回错误 ' + res.status + (detail ? '：' + detail : ''));
  }

  const data = await res.json();
  return parse(data);
}

// 有本地服务时优先走同源转发（对所有 provider 都稳、无 CORS）；
// 无本地服务（纯静态部署）时浏览器直连，被 CORS 拦则给明确提示。
export async function callAI(messages, settings, opts = {}) {
  const json = opts.json !== false;
  if (context.bridgeAvailable) {
    try {
      return await callAIOnce(messages, json, settings, true);
    } catch (err) {
      if (!(err instanceof TypeError)) throw err; // 业务错误直接抛；桥本身异常才退回直连
    }
  }
  try {
    return await callAIOnce(messages, json, settings, false);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new AppError('cors', '无法连接 AI 服务：浏览器直连被 CORS 拦截。请启动本地服务（npm run dev，或 npm run build && npm start）后重试');
    }
    throw err;
  }
}

export async function callAIWithRetry(messages, settings, opts = {}) {
  let lastErr;
  for (let attempt = 0; attempt < context.aiBaseRetry; attempt++) {
    try {
      return await callAI(messages, settings, opts);
    } catch (e) {
      lastErr = e;
      if (e.code === 'key_invalid') throw e; // 密钥错误不必重试
      if (attempt < context.aiBaseRetry - 1) await sleep(2000 * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}
