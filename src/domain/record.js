// 记录创建 / 处理流程（顺序队列）/ 示例数据
import { emptyFields } from '../contract/fields.js';
import { uid } from '../core/util.js';
import { normalizeJson, extractJsonText, truncateText } from '../ai/parse.js';
import { SYSTEM_PROMPT, JSON_SCHEMA_HINT, MAX_CHARS } from '../ai/providers.js';
import { callAIWithRetry } from '../ai/client.js';
import { extractPdfText, ocrPdf } from './pdf.js';
import { setText } from '../core/store.js';

export function createRecord(opts = {}) {
  return {
    id: uid(),
    filename: '',
    status: 'parsing',
    statusText: '',
    errMsg: '',
    text: '',
    zoteroKey: null,
    translating: false,
    ...emptyFields(),
    ...opts,
  };
}

// 单篇处理：解析（含 OCR 兜底）→ 存全文 → AI 提炼 → 规范化
// onProgress(rec | (i,total)) 用于逐页 / 状态进度更新
export async function processRecord(rec, file, settings, onProgress) {
  rec.status = 'parsing';
  rec.errMsg = '';
  if (onProgress) onProgress(rec);

  let { text, pdf } = await extractPdfText(file, onProgress);

  if (text.replace(/\s/g, '').length < 30) {
    rec.status = 'ai';
    rec.statusText = 'OCR 识别中…';
    if (onProgress) onProgress(rec);
    let ocrText = '';
    try {
      ocrText = await ocrPdf(pdf, onProgress);
    } catch (ocrErr) {
      throw new Error(ocrErr.message || '该 PDF 没有可提取的文本层（可能是扫描件），且 OCR 失败');
    }
    if (ocrText.replace(/\s/g, '').length < 30) {
      throw new Error('OCR 后仍未提取到有效文本，该 PDF 可能是图片质量过低或空白页');
    }
    text = ocrText;
  }

  setText(rec, text);
  rec.status = 'ai';
  rec.statusText = 'AI 分析中…';
  if (onProgress) onProgress(rec);

  const raw = await callAIWithRetry([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: truncateText(text, MAX_CHARS) + JSON_SCHEMA_HINT },
  ], settings, { json: true });

  Object.assign(rec, normalizeJson(JSON.parse(extractJsonText(raw))));
  rec.status = 'done';
  rec.statusText = '完成';
  rec.errMsg = '';
  return rec;
}

export function loadSamples() {
  const mk = (o) => createRecord({ status: 'done', statusText: '完成', errMsg: '', text: '', ...o });
  return [
    mk({ filename: '示例-Attention Is All You Need.pdf', title: 'Attention Is All You Need', authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'], year: '2017', keywords: ['Transformer', '注意力机制', '机器翻译', 'NLP'], research_question: '能否完全基于注意力机制构建序列转换模型，摆脱循环与卷积结构？', methodology: '提出 Transformer 架构：仅用自注意力与前馈层，配合多头注意力与位置编码，可完全并行训练。', data_and_sample: 'WMT 2014 英德 / 英法翻译数据集（约 450 万 / 3600 万句对）。', main_findings: 'WMT 2014 英德任务取得 28.4 BLEU，刷新当时最优；训练成本显著低于此前模型。', innovation: '首个纯注意力序列转换架构，抛弃循环与卷积，训练可高度并行。', limitations: '自注意力对序列长度呈二次复杂度，处理超长文本开销大。', one_sentence_summary: '提出纯注意力架构 Transformer，以更低训练成本刷新机器翻译最优成绩。' }),
    mk({ filename: '示例-Deep Residual Learning.pdf', title: 'Deep Residual Learning for Image Recognition', authors: ['Kaiming He', 'Xiangyu Zhang', 'Shaoqing Ren', 'Jian Sun'], year: '2016', keywords: ['ResNet', '残差学习', '图像识别', '深度学习'], research_question: '网络加深后出现退化问题，残差学习能否让深层网络稳定训练？', methodology: '引入恒等捷径连接（shortcut），让堆叠层学习残差映射 F(x)+x，便于优化。', data_and_sample: 'ImageNet 2014 分类数据集；CIFAR-10。', main_findings: '152 层 ResNet 取得 ImageNet top-5 错误率 3.57%，获 ILSVRC 2015 分类冠军。', innovation: '残差连接突破深度瓶颈，使上百层网络可稳定训练。', limitations: '极深网络存在层冗余，推理计算成本仍较高。', one_sentence_summary: '用残差连接解决深层网络退化问题，把可用网络深度推至上百层。' }),
    mk({ filename: '示例-BERT.pdf', title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding', authors: ['Jacob Devlin', 'Ming-Wei Chang', 'Kenton Lee', 'Kristina Toutanova'], year: '2019', keywords: ['BERT', '预训练', '双向编码', 'NLP'], research_question: '深度双向预训练表征能否广泛迁移并提升各类下游 NLP 任务？', methodology: '用掩码语言模型（MLM）与下一句预测（NSP）预训练 Transformer 编码器，再对下游任务统一微调。', data_and_sample: 'BooksCorpus 与英文维基百科（共约 33 亿词）。', main_findings: '11 项 NLP 任务刷新最优，GLUE 基准平均提升 7.7 个百分点。', innovation: '确立"深度双向预训练 + 统一微调"范式，无需为单任务定制结构。', limitations: '预训练成本高；NSP 任务的有效性后来受到质疑。', one_sentence_summary: '证明深度双向预训练表征可一次性迁移至 11 项 NLP 任务并全面刷新纪录。' }),
  ];
}
