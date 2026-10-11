// 极简静态文件服务（零依赖）：托管 Vite 产出的 dist/
import { createReadStream, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.bcmap': 'application/octet-stream',
};

function statFile(p) {
  try {
    const st = statSync(p);
    return st.isFile() ? st : null;
  } catch {
    return null;
  }
}

// 返回 true 表示已处理
export function serveStatic(req, res, distDir) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const root = resolve(distDir);
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    pathname = new URL(req.url, 'http://localhost').pathname;
  }

  let filePath = resolve(root, '.' + pathname);
  // 目录穿越防护：越界则回退到 index.html
  if (!(filePath === root || filePath.startsWith(root + sep))) filePath = join(root, 'index.html');

  let st = statFile(filePath);
  if (!st && !extname(pathname)) {
    // SPA fallback：无扩展名的路径交给 index.html
    filePath = join(root, 'index.html');
    st = statFile(filePath);
  }
  if (!st) return false;

  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  if (req.method === 'HEAD') { res.end(); return true; }
  createReadStream(filePath).pipe(res);
  return true;
}
