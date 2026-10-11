// 运行时配置（桥地址、轮询间隔、AI 超时、bridgeAvailable）
// bridgeBase 为空串 = 与页面同源（dev/preview/prod 均由本地服务同时提供页面与桥）
export const context = {
  bridgeBase: '',
  bridgeAvailable: false,
  pollInterval: 2500,
  aiTimeout: 60000,
  aiBaseRetry: 3,
};
