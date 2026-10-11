// 服务商表 + 提示词常量（从旧 index.html 471–487 行迁移）
// 统一抽象为 openai / anthropic 两种接口风格
export const PROVIDERS = {
  glm: {
    name: '智谱 GLM', base: 'https://open.bigmodel.cn/api/paas/v4',
    style: 'openai', json: true,
    models: ['glm-4-flash-250414', 'glm-4.7-flash', 'glm-4.6', 'glm-4-plus'],
    site: 'open.bigmodel.cn', note: 'glm-4-flash 系列免费',
  },
  deepseek: {
    name: 'DeepSeek', base: 'https://api.deepseek.com',
    style: 'openai', json: true,
    models: ['deepseek-chat', 'deepseek-reasoner'],
    site: 'platform.deepseek.com', note: '',
  },
  qwen: {
    name: '通义千问', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    style: 'openai', json: true,
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen3-max'],
    site: 'bailian.console.aliyun.com', note: '开通模型服务后创建 API Key',
  },
  openai: {
    name: 'OpenAI GPT', base: 'https://api.openai.com/v1',
    style: 'openai', json: true,
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    site: 'platform.openai.com', note: '',
  },
  gemini: {
    name: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    style: 'openai', json: true,
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    site: 'aistudio.google.com', note: '走 OpenAI 兼容接口',
  },
  claude: {
    name: 'Anthropic Claude', base: 'https://api.anthropic.com/v1',
    style: 'anthropic', json: false,
    models: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1'],
    site: 'console.anthropic.com', note: '',
  },
};

export const SYSTEM_PROMPT = '你是学术论文分析助手。请从用户提供的文献文本中提取结构化信息，严格只输出一个 JSON 对象，不要输出任何其他文字、解释或 markdown 代码块。若某字段无法从文本中找到，填写"未提及"。keywords 为 3-6 个字符串组成的数组，authors 为字符串数组。禁止虚构内容。';

export const JSON_SCHEMA_HINT = '\n\n请严格按以下 JSON Schema 输出（所有字段必须存在）：\n{"title":"","authors":[],"year":"","keywords":[],"research_question":"","methodology":"","data_and_sample":"","main_findings":"","innovation":"","limitations":"","one_sentence_summary":""}';

export const TRANSLATE_PROMPT = '你是学术文献翻译助手。用户会给你一个 JSON，请把其中 title、one_sentence_summary、main_findings、research_question、methodology 全部翻译成简体中文（专业术语准确、语句通顺）。严格只输出一个 JSON 对象：{"title_zh":"...","summary_zh":"...","findings_zh":"...","rq_zh":"...","method_zh":"..."}，五个字段都必须存在，不要输出任何其他文字或 markdown 代码块。禁止编造。';

export const CHAT_PROMPT = '你是学术论文问答助手。请只依据下面提供的文献内容回答用户问题，用中文、简洁准确；文献中没有的信息要明确回答"文献中未提及"，禁止编造。\n\n===== 文献内容 =====\n';

export const CHAT_PROMPT_MULTI = '你是学术论文问答助手。用户提供了多篇文献的内容，请综合对比这些文献回答问题，用中文、简洁准确；可以指出文献之间的异同；文献中没有的信息要明确回答"文献中未提及"，禁止编造。\n\n===== 文献内容 =====\n';

export const MAX_CHARS = 60000;

// 取当前 provider 的运行配置（base / key / model）
export function getProviderCfg(settings) {
  const p = settings.provider || 'glm';
  const saved = (settings.providers && settings.providers[p]) || {};
  return {
    id: p,
    ...PROVIDERS[p],
    key: saved.key || '',
    model: saved.model || PROVIDERS[p].models[0],
  };
}
