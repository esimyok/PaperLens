// PDF 解析（pdf.js v4） + 扫描件 OCR 兜底（tesseract.js 本地化资源）
// 关键：v4 为 ESM，worker 必须显式配 ?url；tesseract 资源从 public/ocr 本地加载
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

import { createWorker } from 'tesseract.js';

// 资源路径随部署 base 自适应（dev 为 /ocr/，build 为 ./ocr/）
const OCR_BASE = import.meta.env.BASE_URL + 'ocr/';

export async function extractPdfText(file, onProgress) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const total = pdf.numPages;
  let text = '';
  for (let i = 1; i <= total; i++) {
    if (onProgress) onProgress(i, total);
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map((it) => it.str).join(' ') + '\n';
  }
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { text, pages: total, pdf };
}

export async function ocrPdf(pdf, onProgress) {
  const worker = await createWorker('chi_sim+eng', 1, {
    workerPath: OCR_BASE + 'worker.min.js',
    corePath: OCR_BASE + 'tesseract-core-simd.wasm.js',
    langPath: OCR_BASE,
  });
  let out = '';
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      if (onProgress) onProgress(i, pdf.numPages);
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 2 });
      const c = document.createElement('canvas');
      c.width = vp.width;
      c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      const r = await worker.recognize(c);
      out += r.data.text + '\n';
    }
  } finally {
    await worker.terminate();
  }
  return out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
