# OCR 本地资源（tesseract.js）

本目录存放 tesseract.js 的**离线资源**，让扫描件 PDF 的 OCR 兜底无需联网。
本目录为**生成物目录**：除本 README 外，其余文件均被 `.gitignore` 忽略，不入库。

## 生成方式
| 文件 | 来源 |
|---|---|
| `worker.min.js`、`tesseract-core*.wasm.js` | `npm install` 的 `postinstall`（`scripts/copy-ocr-assets.mjs`）从 `node_modules` 拷贝 |
| `chi_sim.traineddata.gz`、`eng.traineddata.gz`（约 31MB） | `npm run ocr:fetch`（`scripts/fetch-ocr-lang.mjs`）下载 |

## 首次拉取后
```bash
npm install        # 生成 worker/wasm
npm run ocr:fetch  # 拉取中英语言包（缺少时扫描件 OCR 首次会走 CDN）
```
`npm run ocr:fetch` 默认只补缺失文件；`npm run ocr:fetch -- --force` 可强制重下。

也可手动下载后放到本目录（文件名必须完全一致）：
- https://tessdata.projectnaptha.com/4.0.0/chi_sim.traineddata.gz
- https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz

## 未放置语言包时
`src/domain/pdf.js` 的 `ocrPdf` 会回退到 tesseract.js 默认 CDN 加载语言包，
即**扫描件 OCR 首次需要联网**（文字层 PDF 不受影响）。发布前应确保已执行
`npm run ocr:fetch`。
