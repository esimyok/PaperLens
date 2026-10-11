// 语言包（chi_sim/eng.traineddata.gz）不在 node_modules 内，由 `npm run ocr:fetch`
// 单独获取。本脚本只拷贝 JS 与 wasm；语言包缺失时仅告警，不写文件、不阻断 install。
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ocr = join(root, 'public', 'ocr');
mkdirSync(ocr, { recursive: true });

const tj = join(root, 'node_modules/tesseract.js/dist');
const tjc = join(root, 'node_modules/tesseract.js-core');

const jsFiles = ['worker.min.js'];
for (const f of jsFiles) {
  const src = join(tj, f);
  if (existsSync(src)) cpSync(src, join(ocr, f));
}

const wasmFiles = [
  'tesseract-core.wasm.js',
  'tesseract-core_lstm.wasm.js',
  'tesseract-core-simd.wasm.js',
  'tesseract-core_lstm-simd.wasm.js',
];
for (const f of wasmFiles) {
  const src = join(tjc, f);
  if (existsSync(src)) cpSync(src, join(ocr, f));
}

// 语言包仅告警（获取方式见 public/ocr/README.md 与 `npm run ocr:fetch`）
const langPacks = ['chi_sim.traineddata.gz', 'eng.traineddata.gz'];
const missing = langPacks.filter((f) => !existsSync(join(ocr, f)));
console.log('[copy-ocr-assets] JS/wasm 已就绪:', jsFiles.concat(wasmFiles).join(', '));
if (missing.length) {
  console.warn('[copy-ocr-assets] 语言包缺失：' + missing.join('、') + ' —— 请运行 `npm run ocr:fetch`（否则扫描件 OCR 首次需联网）');
} else {
  console.log('[copy-ocr-assets] OCR 语言包已就绪:', langPacks.join(', '));
}
