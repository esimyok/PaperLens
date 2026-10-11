// 数据模型：11 个 AI 抽取字段 + 展示字段定义
// 从旧 index.html 常量迁移（471–494 行）

// AI 抽取字段（顺序即 normalizeJson 的遍历顺序）
export const AI_FIELDS = [
  'title', 'authors', 'year', 'keywords',
  'research_question', 'methodology', 'data_and_sample',
  'main_findings', 'innovation', 'limitations', 'one_sentence_summary',
];

// 明细卡字段（可由列设置收起）
export const DETAIL_FIELDS = [
  'research_question', 'methodology', 'data_and_sample',
  'main_findings', 'innovation', 'limitations',
];

export const DETAIL_LABELS = {
  research_question: '研究问题',
  methodology: '研究方法',
  data_and_sample: '数据 / 样本',
  main_findings: '主要结论',
  innovation: '创新点',
  limitations: '局限性',
};

// 全部展示字段标签（含行内列 filename / title / keywords / 一句话总结 等）
export const FIELD_LABELS = {
  title: '标题',
  authors: '作者',
  year: '年份',
  keywords: '关键词',
  filename: '文件名',
  one_sentence_summary: '一句话总结',
  ...DETAIL_LABELS,
};

// 行内扫描列
export const ROW_FIELDS = ['title', 'authors', 'year', 'keywords', 'one_sentence_summary'];

// 导出列（含 filename 非抽取列）
export const EXPORT_COLS = [
  'filename', 'title', 'authors', 'year', 'keywords',
  'research_question', 'methodology', 'data_and_sample',
  'main_findings', 'innovation', 'limitations', 'one_sentence_summary',
];

// 空字段模板（注意：含数组，使用时必须深拷贝，见 emptyFields()）
export const EMPTY = {
  title: '—',
  authors: ['未提及'],
  year: '—',
  keywords: ['未提及'],
  research_question: '—',
  methodology: '—',
  data_and_sample: '—',
  main_findings: '—',
  innovation: '—',
  limitations: '—',
  one_sentence_summary: '—',
};

// 返回一份全新的空字段对象（避免数组引用共享）
export function emptyFields() {
  return JSON.parse(JSON.stringify(EMPTY));
}

// 翻译字段对照（中文译文字段名）
export const ZH_FIELDS = {
  title: 'title_zh',
  research_question: 'rq_zh',
  methodology: 'method_zh',
  main_findings: 'findings_zh',
  one_sentence_summary: 'summary_zh',
};

export const NOT_MENTIONED = '未提及';
