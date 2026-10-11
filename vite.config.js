import { defineConfig } from 'vite';
import { handleBridge } from './server/bridge.mjs';

// 让 dev / preview 也提供本地桥（/ping /selected /ai/*），与页面同源。
// 生产由 server/index.mjs 提供同一套 handler（server/bridge.mjs），逻辑只此一份。
function bridgePlugin() {
  const middleware = (req, res, next) => {
    handleBridge(req, res)
      .then((handled) => { if (!handled) next(); })
      .catch((e) => {
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('bridge error: ' + String((e && e.message) || e));
      });
  };
  return {
    name: 'siftlit-bridge',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

// SiftLit npm 分支 Vite 配置
// - base: './' 让 dist/ 可被任意子路径静态托管
// - 单进程模型：dev/preview 由 Vite + bridgePlugin，生产由 server/index.mjs，均同源（无 CORS）
// - pdf.js v4 worker 通过 src/domain/pdf.js 中的 `?url` 导入处理，无需额外 plugin
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
  server: { port: 5173, host: 'localhost' },
  plugins: [bridgePlugin()],
});
