let currentResult = null;
let leaderboard = [];
let deepseekModels = [];

const $ = (id) => document.getElementById(id);

window.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await initApp();
});

function bindEvents() {
  $('saveKeyBtn').onclick = saveKey;
  $('loadKeyBtn').onclick = loadKey;
  $('clearKeyBtn').onclick = clearKey;
  $('saveModelBtn').onclick = saveModelChoice;
  $('modelSelect').onchange = updateModelInfo;
  $('toggleKeyBtn').onclick = () => $('apiKey').type = $('apiKey').type === 'password' ? 'text' : 'password';
  $('openDataFolderBtn').onclick = () => window.resumeApp.openDataFolder();

  $('restoreDefaultBtn').onclick = restoreDefaultStandard;
  $('saveStandardBtn').onclick = saveStandard;
  $('loadStandardBtn').onclick = loadSavedStandard;
  document.querySelectorAll('[data-add]').forEach(btn => btn.onclick = () => addRequirement(btn.dataset.add));

  $('selectResumeBtn').onclick = selectAndParseResume;
  $('analyzeBtn').onclick = analyze;
  $('fillNotesBtn').onclick = fillNotes;
  $('addCurrentToRankBtn').onclick = () => currentResult && addToLeaderboard(currentResult, true);

  $('exportCsvBtn').onclick = exportCSV;
  $('clearRankBtn').onclick = clearLeaderboard;
}

async function initApp() {
  await initModelSelect();
  const savedStandard = await window.resumeApp.loadStandard();
  if (savedStandard) setStandardToForm(savedStandard);
  else setStandardToForm(await window.resumeApp.getDefaultStandard());

  const key = await window.resumeApp.loadKey();
  if (key?.modelKey) {
    $('modelSelect').value = key.modelKey;
    updateModelInfo();
  }
  if (key?.apiKey) {
    $('apiKey').value = key.apiKey;
    show('keySuccess', '已读取本机保存的 API Key。');
  }

  leaderboard = await window.resumeApp.loadLeaderboard();
  renderLeaderboard();
}

async function saveKey() {
  hideMessages(['keySuccess', 'keyError']);
  try {
    await window.resumeApp.saveKey($('apiKey').value.trim());
    show('keySuccess', 'API Key 已保存到当前电脑本地。');
  } catch (err) { show('keyError', err.message || String(err)); }
}

async function loadKey() {
  hideMessages(['keySuccess', 'keyError']);
  const data = await window.resumeApp.loadKey();
  if (data?.modelKey) {
    $('modelSelect').value = data.modelKey;
    updateModelInfo();
  }
  if (data?.apiKey) {
    $('apiKey').value = data.apiKey;
    show('keySuccess', '已读取本机保存的 API Key。');
  } else show('keyError', '当前电脑还没有保存 API Key。');
}

async function clearKey() {
  if (!confirm('确定清除已保存的 API Key 吗？')) return;
  await window.resumeApp.clearKey();
  $('apiKey').value = '';
  show('keySuccess', '已清除 API Key。');
}

async function initModelSelect() {
  try {
    deepseekModels = await window.resumeApp.getDeepSeekModels();
  } catch {
    deepseekModels = [
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash｜严谨推理', thinking: 'enabled', note: '默认推荐' },
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash｜快速评分', thinking: 'disabled', note: '适合批量初筛' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro｜高质量推理', thinking: 'enabled', note: '更慢、更贵' },
      { id: 'deepseek-chat', label: 'Legacy deepseek-chat｜兼容快速模式', thinking: '', note: '旧兼容模型名' },
      { id: 'deepseek-reasoner', label: 'Legacy deepseek-reasoner｜兼容推理模式', thinking: '', note: '旧兼容模型名' }
    ];
  }
  const select = $('modelSelect');
  select.innerHTML = '';
  deepseekModels.forEach(m => {
    const opt = document.createElement('option');
    opt.value = `${m.id}:${m.thinking || ''}`;
    opt.textContent = m.label;
    select.appendChild(opt);
  });
  select.value = 'deepseek-v4-flash:enabled';
  updateModelInfo();
}

function updateModelInfo() {
  const key = $('modelSelect').value;
  const m = deepseekModels.find(x => `${x.id}:${x.thinking || ''}` === key);
  $('modelInfo').textContent = m ? `${m.note}。实际调用：${m.id}${m.thinking ? ' / thinking=' + m.thinking : ''}` : '当前模型配置将随评分请求一起发送。';
}

async function saveModelChoice() {
  try {
    await window.resumeApp.saveModel($('modelSelect').value);
    show('keySuccess', '模型选择已保存。');
  } catch (err) {
    show('keyError', err.message || String(err));
  }
}

function setStandardToForm(data) {
  $('jobTitle').value = data.jobTitle || '';
  $('positionOverview').value = data.positionOverview || '';
  $('scoringRule').value = data.scoringRule || '';
  renderEditableList('mustHaveList', data.mustHave || []);
  renderEditableList('bonusList', data.niceToHave || []);
  renderEditableList('vetoList', data.vetoItems || []);
}

function getStandardFromForm() {
  return {
    jobTitle: value('jobTitle'),
    positionOverview: value('positionOverview'),
    scoringRule: value('scoringRule'),
    mustHave: getEditableItems('mustHaveList'),
    niceToHave: getEditableItems('bonusList'),
    vetoItems: getEditableItems('vetoList')
  };
}

function renderEditableList(containerId, items) {
  const box = $(containerId);
  box.innerHTML = '';
  items.forEach(item => appendEditableRow(containerId, item));
}

function appendEditableRow(containerId, text = '') {
  const box = $(containerId);
  const row = document.createElement('div');
  row.className = 'list-row';
  const input = document.createElement('input');
  input.value = text;
  input.placeholder = containerId === 'mustHaveList'
    ? '硬条件示例：必须有明确 B2B Sales 经历，且简历中体现 quota/revenue/closing。'
    : containerId === 'bonusList'
      ? '具体加分示例：有 AWS/Azure/GCP/腾讯云等云厂战略客户销售经验优先。'
      : '强风险示例：不会法语且无法支持法国客户商务沟通。';
  const del = document.createElement('button');
  del.className = 'danger small';
  del.textContent = '删除';
  del.onclick = () => row.remove();
  row.append(input, del);
  box.appendChild(row);
}

function addRequirement(type) {
  if (type === 'must') appendEditableRow('mustHaveList');
  if (type === 'bonus') appendEditableRow('bonusList');
  if (type === 'veto') appendEditableRow('vetoList');
}

function getEditableItems(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} input`)).map(i => i.value.trim()).filter(Boolean);
}

async function saveStandard() {
  const standard = getStandardFromForm();
  if (!standard.mustHave.length) return setStatus('standardStatus', '必要项不能为空。');
  await window.resumeApp.saveStandard(standard);
  setStatus('standardStatus', '岗位标准已保存。');
}

async function loadSavedStandard() {
  const standard = await window.resumeApp.loadStandard();
  if (!standard) return setStatus('standardStatus', '当前还没有保存过岗位标准。');
  setStandardToForm(standard);
  setStatus('standardStatus', '已读取保存的岗位标准。');
}

async function restoreDefaultStandard() {
  if (!confirm('确定恢复默认法国销售岗标准吗？当前修改会被覆盖。')) return;
  await window.resumeApp.clearStandard();
  setStandardToForm(await window.resumeApp.getDefaultStandard());
  setStatus('standardStatus', '已恢复默认法国销售岗标准。');
}

async function selectAndParseResume() {
  hideMessages(['resumeWarning', 'resumeError']);
  setStatus('resumeStatus', '正在读取简历……');
  try {
    const data = await window.resumeApp.selectAndParseResume();
    if (data?.canceled) return setStatus('resumeStatus', '已取消选择。');
    $('resumeText').value = data.text || '';
    setStatus('resumeStatus', `读取完成：${data.filename}，共 ${data.charCount} 个字符。`);
    if (data.warning) show('resumeWarning', data.warning);
  } catch (err) {
    setStatus('resumeStatus', '');
    show('resumeError', err.message || String(err));
  }
}

async function analyze() {
  hideMessages(['analyzeError']);
  const standard = getStandardFromForm();
  if (!standard.mustHave.length) return show('analyzeError', '必要项不能为空。');
  if (!value('resumeText')) return show('analyzeError', '请先读取或粘贴候选人简历。');

  $('analyzeBtn').disabled = true;
  setStatus('analyzeStatus', 'AI 正在评估简历，并提取原文依据、置信度与风险项……');

  try {
    const result = await window.resumeApp.analyze({
      apiKey: value('apiKey'),
      modelKey: value('modelSelect'),
      passLine: Number(value('passLine') || 75),
      extraNotes: value('extraNotes'),
      resumeText: value('resumeText'),
      ...standard
    });
    currentResult = result;
    renderResult(result);
    await addToLeaderboard(result, false);
    setStatus('analyzeStatus', '评分完成，已自动加入排行榜。');
  } catch (err) {
    setStatus('analyzeStatus', '');
    show('analyzeError', err.message || String(err));
  } finally {
    $('analyzeBtn').disabled = false;
  }
}

function renderResult(data) {
  $('result').style.display = 'block';
  const score = Number(data.score || 0);
  const deg = Math.round(score * 3.6);
  $('scoreText').textContent = score;
  $('scoreCircle').style.background = `radial-gradient(circle at center,#fff 57%,transparent 58%), conic-gradient(#1e6b82 ${deg}deg,#e2e8f0 ${deg}deg)`;

  $('summaryBox').innerHTML = `<strong>${escapeHtml(data.candidateName)}｜${escapeHtml(data.level)}</strong><br>
    综合评分：<strong>${score}/100</strong>；推进建议：<strong>${escapeHtml(data.recommendation)}</strong><br>
    使用模型：<strong>${escapeHtml(data.modelLabel || data.model || 'DeepSeek')}</strong><br>
    ${escapeHtml(data.summary || '')}`;

  $('confidenceText').textContent = `${data.confidence || 0}%`;
  $('uncertaintyReason').textContent = data.dataQuality?.uncertaintyReason || '证据越充分，置信度越高。';

  const b = data.scoreBreakdown || {};
  setText('mSales', b.sales); setText('mIndustry', b.industry); setText('mAccount', b.account); setText('mClosing', b.closing);
  setText('mLocation', b.location); setText('mLanguage', b.language); setText('mBonus', b.bonus); setText('mOverall', b.overall);

  const u = data.usage || {};
  setText('usedModel', data.modelLabel || data.model || '-');
  setText('promptTokens', u.promptTokens || 0);
  setText('completionTokens', u.completionTokens || 0);
  setText('totalTokens', u.totalTokens || 0);
  setText('cacheHitTokens', u.cacheHitTokens || 0);
  setText('cacheMissTokens', u.cacheMissTokens || 0);
  setText('reasoningTokens', u.reasoningTokens || 0);

  renderChecks('mustHaveResult', data.mustHaveCheck);
  renderChecks('bonusResult', data.bonusCheck);
  renderChecks('vetoResult', data.vetoCheck);
  renderList('matchedPoints', data.matchedPoints);
  renderList('missingPoints', data.missingPoints);
  renderList('riskPoints', data.riskPoints);
  renderList('verificationItems', data.verificationItems);
  renderList('interviewQuestions', data.interviewQuestions);
  renderList('evidenceQuotes', data.evidenceQuotes);

  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderChecks(id, items) {
  const box = $(id);
  box.innerHTML = '';
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) { box.innerHTML = '<div class="check-row">暂无</div>'; return; }
  arr.forEach(x => {
    const row = document.createElement('div');
    row.className = 'check-row';
    row.innerHTML = `<div class="check-top"><strong>${escapeHtml(x.item || '')}</strong><span class="badge ${badgeClass(x.status)}">${escapeHtml(x.status || '待核实')}</span></div>
      <div class="evidence"><strong>依据：</strong>${escapeHtml(x.evidence || '无明确证据')}</div>
      <div class="reason"><strong>原因：</strong>${escapeHtml(x.reason || '')} ｜置信度 ${Number(x.confidence || 0)}%</div>`;
    box.appendChild(row);
  });
}

function badgeClass(status) {
  const v = String(status || '');
  if (v === '满足' || v === '有' || v === '未命中') return 'good';
  if (v.includes('部分') || v.includes('待核实')) return 'mid';
  if (v.includes('不满足') || v === '无' || v === '命中') return 'bad';
  return 'mid';
}

async function addToLeaderboard(data, showAlert) {
  const item = {
    id: Date.now(),
    candidateName: data.candidateName || '待识别',
    score: Number(data.score || 0),
    confidence: Number(data.confidence || 0),
    level: data.level || '',
    recommendation: data.recommendation || '',
    model: data.modelLabel || data.model || 'DeepSeek',
    totalTokens: Number(data.usage?.totalTokens || 0),
    summary: data.summary || '',
    time: new Date().toLocaleString()
  };
  leaderboard.push(item);
  leaderboard.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  await window.resumeApp.saveLeaderboard(leaderboard);
  renderLeaderboard();
  if (showAlert) alert('已加入排行榜。');
}

function renderLeaderboard() {
  const body = $('leaderboardBody');
  body.innerHTML = '';
  leaderboard.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  if (!leaderboard.length) { body.innerHTML = '<tr><td colspan="10">暂无候选人评分记录</td></tr>'; return; }
  leaderboard.forEach((x, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><span class="rank-num">${index + 1}</span></td>
      <td><strong>${escapeHtml(x.candidateName)}</strong><br><span style="color:#64748b">${escapeHtml(x.summary || '')}</span></td>
      <td><strong>${x.score}</strong></td>
      <td>${x.confidence}%</td>
      <td>${escapeHtml(x.model || '-')}</td>
      <td>${Number(x.totalTokens || 0)}</td>
      <td>${escapeHtml(x.level)}</td>
      <td>${escapeHtml(x.recommendation)}</td>
      <td>${escapeHtml(x.time)}</td>
      <td><button class="danger small" data-del="${x.id}">删除</button></td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
    leaderboard = leaderboard.filter(x => String(x.id) !== String(btn.dataset.del));
    await window.resumeApp.saveLeaderboard(leaderboard);
    renderLeaderboard();
  });
}

async function clearLeaderboard() {
  if (!confirm('确定清空排行榜吗？')) return;
  leaderboard = [];
  await window.resumeApp.clearLeaderboard();
  renderLeaderboard();
}

function exportCSV() {
  if (!leaderboard.length) return alert('排行榜为空。');
  const rows = [['排名','候选人','分数','置信度','模型','Token','等级','建议','时间','摘要'], ...leaderboard.map((x, i) => [i+1, x.candidateName, x.score, x.confidence, x.model || '', x.totalTokens || 0, x.level, x.recommendation, x.time, x.summary])];
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'candidate_leaderboard.csv'; a.click();
  URL.revokeObjectURL(url);
}

function fillNotes() {
  $('extraNotes').value = '请严格判断候选人是否是真正 Sales，而不是售前或客户成功；法语、英语、巴黎/法国 base 是关键必要项；云厂背景、Retail/Telecom/eCommerce/Gaming 经验优先。所有判断必须引用简历原文依据，证据不足请写待核实。';
}

function renderList(id, items) {
  const ul = $(id); ul.innerHTML = '';
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) { const li = document.createElement('li'); li.textContent = '暂无'; ul.appendChild(li); return; }
  arr.forEach(item => { const li = document.createElement('li'); li.textContent = String(item); ul.appendChild(li); });
}

function value(id) { return $(id).value.trim(); }
function setText(id, value) { $(id).textContent = value ?? 0; }
function setStatus(id, text) { $(id).textContent = text || ''; }
function show(id, text) { const el = $(id); el.textContent = text; el.style.display = 'block'; }
function hideMessages(ids) { ids.forEach(id => { const el = $(id); el.textContent = ''; el.style.display = 'none'; }); }
function escapeHtml(str) { return String(str || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#039;'); }
