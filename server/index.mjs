// SiftLit 单进程服务（生产）：托管 dist/ + 本地桥（Zotero / AI 同源转发）
// 用法：npm run build && npm start    （默认 http://127.0.0.1:4173）
// 开发请用：npm run dev（Vite + 同一套桥中间件，同源）
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleBridge, ALLOWED_AI_HOSTS } from './bridge.mjs';
import { serveStatic } from './static.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('未找到 dist/index.html —— 请先运行：npm run build');
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    if (await handleBridge(req, res)) return;
    if (serveStatic(req, res, DIST)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  } catch (e) {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500 ' + String((e && e.message) || e));
  }
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/`;
  console.log('='.repeat(52));
  console.log('SiftLit 已启动：' + url);
  console.log('  静态站点：dist/（含 OCR 本地资源）');
  console.log('  Zotero 联动：/ping /selected');
  console.log(`  AI 同源转发：/ai/<host>（白名单 ${ALLOWED_AI_HOSTS.size} 个 provider）`);
  console.log('  关闭本窗口即退出');
  console.log('='.repeat(52));
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { server.close(() => process.exit(0)); });
}
