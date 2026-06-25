const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const APP_NAME = '简历岗位匹配评分系统';

function createWindow() {
  const win = new BrowserWindow({
    width: 1380,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    title: APP_NAME,
    backgroundColor: '#f4f7fb',
    icon: path.join(__dirname, '../assets/app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function dataPath(filename) {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, filename);
}

function readJson(filename, fallback) {
  try {
    const file = dataPath(filename);
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filename, data) {
  fs.writeFileSync(dataPath(filename), JSON.stringify(data, null, 2), 'utf-8');
  return true;
}

function cleanText(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 90000);
}

async function parseResumeFile(filePath) {
  const lower = filePath.toLowerCase();
  const buffer = fs.readFileSync(filePath);
  let text = '';
  let warning = '';

  if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    text = buffer.toString('utf-8');
  } else if (lower.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value || '';
  } else if (lower.endsWith('.pdf')) {
    const result = await pdfParse(buffer);
    text = result.text || '';
    if (text.trim().length < 100) {
      warning = '这个 PDF 可能是扫描件或图片型 PDF，自动读取到的文字较少。建议换 Word 简历，或直接复制简历正文粘贴。';
    }
  } else {
    throw new Error('暂不支持该文件格式。请上传 PDF、Word、txt，或直接粘贴简历正文。');
  }

  return {
    filename: path.basename(filePath),
    filePath,
    text: cleanText(text),
    charCount: cleanText(text).length,
    warning
  };
}

function parseModelJson(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('模型没有返回合法 JSON：' + cleaned.slice(0, 500));
    return JSON.parse(match[0]);
  }
}

function clamp(n, min, max) {
  const v = Number(n);
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function arr(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizeUsage(usage) {
  const u = usage || {};
  const details = u.completion_tokens_details || {};
  return {
    promptTokens: Number(u.prompt_tokens || 0),
    completionTokens: Number(u.completion_tokens || 0),
    totalTokens: Number(u.total_tokens || 0),
    cacheHitTokens: Number(u.prompt_cache_hit_tokens || 0),
    cacheMissTokens: Number(u.prompt_cache_miss_tokens || 0),
    reasoningTokens: Number(details.reasoning_tokens || 0)
  };
}

const DEEPSEEK_MODELS = [
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash｜快速评分', thinking: 'disabled', note: '速度快、成本低，适合批量初筛' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash｜严谨推理', thinking: 'enabled', note: '默认推荐的严谨模式，适合重点候选人复核' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro｜高质量评分', thinking: 'disabled', note: '质量更高、成本更高' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro｜高质量推理', thinking: 'enabled', note: '最严谨但更慢、更贵' },
  { id: 'deepseek-chat', label: 'Legacy deepseek-chat｜兼容快速模式', thinking: '', note: '旧兼容模型名，对应非思考模式' },
  { id: 'deepseek-reasoner', label: 'Legacy deepseek-reasoner｜兼容推理模式', thinking: '', note: '旧兼容模型名，对应思考模式' }
];

function getModelConfig(modelKey) {
  const key = String(modelKey || 'deepseek-v4-flash:enabled');
  const [id, thinking = ''] = key.split(':');
  const found = DEEPSEEK_MODELS.find(m => m.id === id && String(m.thinking || '') === thinking);
  if (found) return found;
  if (id) return { id, label: id, thinking, note: '自定义模型' };
  return DEEPSEEK_MODELS[1];
}

function normalizeChecks(value) {
  if (!Array.isArray(value)) return [];
  return value.map(x => ({
    item: String(x?.item || ''),
    status: String(x?.status || '待核实'),
    evidence: String(x?.evidence || ''),
    reason: String(x?.reason || ''),
    confidence: clamp(x?.confidence ?? 0, 0, 100)
  })).filter(x => x.item);
}

function normalizeResult(data, passLine) {
  const score = clamp(data?.score ?? 0, 0, 100);
  const confidence = clamp(data?.confidence ?? 0, 0, 100);

  let level = data?.level;
  if (!level) {
    if (score >= 85) level = '强匹配';
    else if (score >= passLine) level = '基本匹配';
    else if (score >= 65) level = '一般匹配';
    else level = '匹配度较低';
  }

  let recommendation = data?.recommendation;
  if (!recommendation) {
    if (score >= 85) recommendation = '优先推进';
    else if (score >= passLine) recommendation = '建议推进';
    else if (score >= 65) recommendation = '作为储备';
    else recommendation = '不建议推进';
  }

  return {
    candidateName: data?.candidateName || '待识别',
    score,
    confidence,
    level,
    recommendation,
    summary: data?.summary || '',
    dataQuality: {
      resumeCompleteness: clamp(data?.dataQuality?.resumeCompleteness ?? confidence, 0, 100),
      evidenceSufficiency: clamp(data?.dataQuality?.evidenceSufficiency ?? confidence, 0, 100),
      uncertaintyReason: String(data?.dataQuality?.uncertaintyReason || '')
    },
    mustHaveCheck: normalizeChecks(data?.mustHaveCheck),
    bonusCheck: normalizeChecks(data?.bonusCheck),
    vetoCheck: normalizeChecks(data?.vetoCheck),
    matchedPoints: arr(data?.matchedPoints),
    riskPoints: arr(data?.riskPoints),
    missingPoints: arr(data?.missingPoints),
    verificationItems: arr(data?.verificationItems),
    interviewQuestions: arr(data?.interviewQuestions),
    evidenceQuotes: arr(data?.evidenceQuotes),
    scoreBreakdown: {
      sales: clamp(data?.scoreBreakdown?.sales ?? 0, 0, 100),
      industry: clamp(data?.scoreBreakdown?.industry ?? 0, 0, 100),
      account: clamp(data?.scoreBreakdown?.account ?? 0, 0, 100),
      closing: clamp(data?.scoreBreakdown?.closing ?? 0, 0, 100),
      location: clamp(data?.scoreBreakdown?.location ?? 0, 0, 100),
      language: clamp(data?.scoreBreakdown?.language ?? 0, 0, 100),
      bonus: clamp(data?.scoreBreakdown?.bonus ?? 0, 0, 100),
      overall: clamp(data?.scoreBreakdown?.overall ?? score, 0, 100)
    },
    model: data?.model || 'deepseek-v4-flash',
    modelLabel: data?.modelLabel || data?.model || 'DeepSeek',
    thinkingMode: data?.thinkingMode || '',
    usage: normalizeUsage(data?.usage),
    createdAt: new Date().toISOString()
  };
}

function buildPrompt(payload) {
  const {
    jobTitle, positionOverview, scoringRule, mustHave, niceToHave, vetoItems,
    extraNotes, resumeText, passLine
  } = payload;

  return `
请你作为严谨的招聘初筛顾问，按照【用户可编辑岗位标准】评估候选人简历。

重要要求：
1. 必须基于简历原文判断，不允许编造简历中没有的信息。
2. 每个必要项、加分项、一票否决项都要给出“判断 + 简历原文依据 + 原因 + 置信度”。
3. 如果简历没有明确写出证据，请写“待核实”，不要强行判断满足。
4. 对低置信度、证据不足、PDF读取可能不完整的情况，要写入 verificationItems。
5. 评分要严格按照岗位标准，不要因为简历写得漂亮就放宽硬性要求。
6. 输出必须是合法 JSON，不要输出 Markdown。

【岗位名称】
${jobTitle}

【岗位说明】
${positionOverview}

【必要项 Must-have】
${mustHave.map((x, i) => `${i + 1}. ${x}`).join('\n')}

【加分项 Nice-to-have】
${niceToHave.length ? niceToHave.map((x, i) => `${i + 1}. ${x}`).join('\n') : '无'}

【一票否决 / 强风险项】
${vetoItems.length ? vetoItems.map((x, i) => `${i + 1}. ${x}`).join('\n') : '无'}

【评分规则】
${scoringRule}

【推进规则】
- ${passLine} 分及以上建议推进。
- 85分以上：强匹配，优先推进。
- 75-84分：基本匹配，建议推进但需验证核心风险。
- 65-74分：可作为储备，除非某项特别突出。
- 65分以下：不建议推进。
- 如果命中一票否决项，recommendation 应倾向于“不建议推进”或“作为储备”，并写清原因。

【额外备注】
${extraNotes || '无'}

【候选人简历】
${resumeText}

请严格输出下面这个 JSON 结构：
{
  "candidateName": "候选人姓名，无法识别写待识别",
  "score": 0,
  "confidence": 0,
  "level": "强匹配/基本匹配/一般匹配/匹配度较低",
  "recommendation": "优先推进/建议推进/作为储备/不建议推进",
  "summary": "150字以内总体判断",
  "dataQuality": {
    "resumeCompleteness": 0,
    "evidenceSufficiency": 0,
    "uncertaintyReason": "如果置信度不足，说明原因"
  },
  "mustHaveCheck": [
    {"item": "必要项原文", "status": "满足/部分满足/不满足/待核实", "evidence": "简历原文短引用；没有证据写无明确证据", "reason": "简短原因", "confidence": 0}
  ],
  "bonusCheck": [
    {"item": "加分项原文", "status": "有/部分有/无/待核实", "evidence": "简历原文短引用；没有证据写无明确证据", "reason": "简短原因", "confidence": 0}
  ],
  "vetoCheck": [
    {"item": "一票否决项原文", "status": "命中/未命中/待核实", "evidence": "简历原文短引用；没有证据写无明确证据", "reason": "简短原因", "confidence": 0}
  ],
  "matchedPoints": ["匹配点1"],
  "riskPoints": ["风险点1"],
  "missingPoints": ["缺失点1"],
  "verificationItems": ["需要人工核实的问题1"],
  "interviewQuestions": ["建议面试追问1"],
  "evidenceQuotes": ["最关键的简历原文依据1"],
  "scoreBreakdown": {
    "sales": 0,
    "industry": 0,
    "account": 0,
    "closing": 0,
    "location": 0,
    "language": 0,
    "bonus": 0,
    "overall": 0
  }
}`.trim();
}

ipcMain.handle('app:get-default-standard', () => ({
  jobTitle: 'Tencent Cloud Senior Strategic Sales Executive / Manager - France',
  positionOverview: '腾讯云法国/南欧高级战略销售岗。岗位 base 巴黎，负责法国及南欧战略客户开发、云业务收入增长、大客户签约、高价值合同谈判，重点行业包括 Retail、Telecom、eCommerce、Gaming。',
  scoringRule: '总分100分：B2B Sales年限与强度20分；云/科技/数字化行业背景20分；战略大客户经验15分；Hunter与Closing能力15分；法国/南欧市场匹配10分；语言能力10分；目标行业经验5分；云厂/AI/电商加分5分。缺少 Sales、法语、法国/巴黎 base 任一核心项时，原则上不建议推进。',
  mustHave: [
    '必须有明确 B2B Sales 经历，简历中需体现客户开发、销售指标、合同签约或 revenue 结果；仅售前、客户成功、市场岗位不算完全满足。',
    '必须有10年以上科技/云计算/数字化领域 B2B 销售经验。',
    '必须有完整销售周期经验：prospecting、lead generation、客户开发、合同签订、账户拓展。',
    '必须有战略大客户或企业级客户管理经验，最好对接 C-level 决策人。',
    '必须英语流利，能进行跨国团队协作和商务沟通。',
    '必须法语熟练，能支持法国客户商务沟通、谈判或高层关系维护。',
    '必须能够 base 巴黎或法国，或明确愿意 relocate 到巴黎/法国。',
    '必须体现 hunter、closing、quota/revenue 结果导向。'
  ],
  niceToHave: [
    '有 AWS、Azure、Google Cloud、Oracle Cloud、阿里云、华为云、腾讯云、OVHcloud、Scaleway 等云厂或云服务商销售经验优先。',
    '卖过 IaaS、PaaS、CDN、安全、数据库、AI 云服务、数据平台、企业 SaaS 等复杂云/数字化解决方案优先。',
    '有法国或南欧战略客户资源优先，尤其是 Retail、Telecom、eCommerce、Gaming 行业客户。',
    '有百万欧元级别或复杂高价值合同谈判经验优先。',
    '有 AI 项目、AI infrastructure、LLM、智能化解决方案经验优先。',
    '有电商行业背景或服务电商客户经验优先。'
  ],
  vetoItems: [
    '没有真正 Sales 经历，只是售前、技术、产品、客户成功或市场。',
    '不会法语，且无法支持法国本地客户商务沟通。',
    '不能 base 巴黎/法国，也没有法国或南欧市场经验。',
    '没有科技、云计算、数字化或企业软件行业销售经验。'
  ]
}));

ipcMain.handle('app:get-deepseek-models', () => DEEPSEEK_MODELS);

ipcMain.handle('settings:load-key', () => {
  const settings = readJson('settings.json', {});
  return { apiKey: settings.apiKey || '', modelKey: settings.modelKey || 'deepseek-v4-flash:enabled' };
});

ipcMain.handle('settings:save-key', (event, apiKey) => {
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('请先输入 DeepSeek API Key。');
  if (!key.startsWith('sk-')) throw new Error('这个 Key 看起来格式不太对。DeepSeek API Key 通常以 sk- 开头。');
  const settings = readJson('settings.json', {});
  settings.apiKey = key;
  writeJson('settings.json', settings);
  return { ok: true };
});

ipcMain.handle('settings:clear-key', () => {
  const settings = readJson('settings.json', {});
  delete settings.apiKey;
  writeJson('settings.json', settings);
  return { ok: true };
});

ipcMain.handle('settings:save-model', (event, modelKey) => {
  const settings = readJson('settings.json', {});
  settings.modelKey = String(modelKey || 'deepseek-v4-flash:enabled');
  writeJson('settings.json', settings);
  return { ok: true };
});

ipcMain.handle('standard:load', () => readJson('standard.json', null));
ipcMain.handle('standard:save', (event, standard) => {
  writeJson('standard.json', standard);
  return { ok: true };
});
ipcMain.handle('standard:clear', () => {
  const file = dataPath('standard.json');
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return { ok: true };
});

ipcMain.handle('resume:select-and-parse', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择候选人简历',
    properties: ['openFile'],
    filters: [
      { name: 'Resume Files', extensions: ['pdf', 'docx', 'txt', 'md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths?.length) return { canceled: true };
  return await parseResumeFile(result.filePaths[0]);
});

ipcMain.handle('leaderboard:load', () => readJson('leaderboard.json', []));
ipcMain.handle('leaderboard:save', (event, items) => {
  writeJson('leaderboard.json', Array.isArray(items) ? items : []);
  return { ok: true };
});
ipcMain.handle('leaderboard:clear', () => {
  writeJson('leaderboard.json', []);
  return { ok: true };
});

ipcMain.handle('app:open-data-folder', () => shell.openPath(app.getPath('userData')));

ipcMain.handle('ai:analyze', async (event, payload) => {
  const settings = readJson('settings.json', {});
  const apiKey = String(payload.apiKey || settings.apiKey || '').trim();
  if (!apiKey) throw new Error('请先输入并保存 DeepSeek API Key。');

  const resumeText = cleanText(payload.resumeText);
  if (!resumeText) throw new Error('简历正文为空。请先读取简历或直接粘贴简历正文。');

  const passLine = Number(payload.passLine || 75);
  const prompt = buildPrompt({ ...payload, resumeText, passLine });

  const modelKey = String(payload.modelKey || settings.modelKey || 'deepseek-v4-flash:enabled');
  const modelConfig = getModelConfig(modelKey);
  settings.modelKey = modelKey;
  writeJson('settings.json', settings);

  const requestBody = {
    model: modelConfig.id,
    messages: [
      {
        role: 'system',
        content: '你是严谨的中文招聘评估助手。你必须只输出合法 JSON，不要输出 Markdown，不要输出多余解释。'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    stream: false,
    response_format: { type: 'json_object' }
  };

  if (modelConfig.thinking === 'enabled' || modelConfig.thinking === 'disabled') {
    requestBody.thinking = { type: modelConfig.thinking };
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify(requestBody)
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error('DeepSeek API 请求失败：' + raw.slice(0, 800));
  }

  const data = JSON.parse(raw);
  const content = data.choices?.[0]?.message?.content || '';
  const parsed = parseModelJson(content);
  return normalizeResult({
    ...parsed,
    model: data.model || modelConfig.id,
    modelLabel: modelConfig.label,
    thinkingMode: modelConfig.thinking || '',
    usage: data.usage || {}
  }, passLine);
});
