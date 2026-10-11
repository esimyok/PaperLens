// 下载 tesseract.js 语言包到 public/ocr/（让 OCR 离线可用）
// 用法：npm run ocr:fetch         仅下载缺失的
//       npm run ocr:fetch -- --force  强制重新下载
import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OCR = join(ROOT, 'public', 'ocr');
const BASE = 'https://tessdata.projectnaptha.com/4.0.0';
const LANGS = ['eng', 'chi_sim'];
const force = process.argv.includes('--force');

mkdirSync(OCR, { recursive: true });

for (const lang of LANGS) {
  const dest = join(OCR, `${lang}.traineddata.gz`);
  if (existsSync(dest) && !force) {
    console.log(`[ocr:fetch] 已存在，跳过：${lang}.traineddata.gz (${statSync(dest).size} B)`);
    continue;
  }
  const url = `${BASE}/${lang}.traineddata.gz`;
  process.stdout.write(`[ocr:fetch] 下载 ${lang} … `);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    console.log(`完成 (${buf.length} B)`);
  } catch (e) {
    console.log('失败：' + e.message);
    process.exitCode = 1;
  }
}

console.log('[ocr:fetch] 完成。语言包位于 public/ocr/');
