let currentResult = null;
let leaderboard = [];
let deepseekModels = [];

const STRICTNESS_TEXT = {
  1: {
    label: '1度｜宽松探索',
    info: '适合人才池拓展。AI 会更愿意认可相邻行业、相关职责和潜力匹配，但仍会标注待核实项。',
    example: '同一情况：候选人有云生态/合作伙伴经验但没有直接云销售。1度会倾向认为“较强相关”，云背景和销售能力可给较高部分分。'
  },
  2: {
    label: '2度｜适度宽松',
    info: '适合一般初筛。AI 可以把相关经验折算为部分满足，但核心必要项仍需要简历证据。',
    example: '同一情况：候选人写过战略客户关系但没有 quota。2度会认为“大客户经验部分满足”，并提醒 quota 待核实。'
  },
  3: {
    label: '3度｜标准推荐',
    info: '默认推荐。AI 严格按岗位标准和简历原文判断；没有明确证据不得给满分。',
    example: '同一情况：候选人有云生态合作经验但没有直接云产品销售。3度会判为“云背景部分满足，直接云销售与 closing 待核实”。'
  },
  4: {
    label: '4度｜严格证据',
    info: '适合重点候选人复核。AI 更看重硬证据，例如 quota、deal size、客户层级、签约结果。',
    example: '同一情况：候选人只写 Business Development，没有写 closing 或合同金额。4度会明显扣分，并把 closing 能力列为风险。'
  },
  5: {
    label: '5度｜极严格硬筛',
    info: '适合高价值岗位或终面前硬筛。AI 只承认直接、明确、可验证的简历证据，模糊项倾向待核实/不满足。',
    example: '同一情况：候选人没有明确写法语商务谈判、法国客户或云产品销售。5度不会推断满足，只会判为待核实或不满足。'
  }
};

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
  $('strictnessLevel').oninput = updateStrictnessInfo;
  $('saveStrictnessBtn').onclick = saveStrictnessChoice;
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
  $('resetRankFilterBtn').onclick = resetLeaderboardFilters;
  $('rankJobFilter').onchange = renderLeaderboard;
  $('rankCategoryFilter').onchange = renderLeaderboard;
  $('rankKeywordFilter').oninput = renderLeaderboard;
  $('rankThisWeekOnly').onchange = renderLeaderboard;
  $('exportBackupBtn').onclick = exportBackup;
  $('importBackupBtn').onclick = importBackup;
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
  if (key?.strictnessLevel) {
    $('strictnessLevel').value = key.strictnessLevel;
  }
  updateStrictnessInfo();
  if (key?.apiKey) {
    $('apiKey').value = key.apiKey;
    show('keySuccess', '已读取本机保存的 API Key。');
  }

  leaderboard = migrateLeaderboard(await window.resumeApp.loadLeaderboard());
  await window.resumeApp.saveLeaderboard(leaderboard);
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
  if (data?.strictnessLevel) {
    $('strictnessLevel').value = data.strictnessLevel;
    updateStrictnessInfo();
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
      strictnessLevel: Number(value('strictnessLevel') || 3),
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

  const profile = data.candidateProfile || {};
  const ageText = profile.ageEstimate || profile.ageRange || '待推断';
  const ageConfidence = Number(profile.ageConfidence || 0);
  const ageBasis = profile.ageInferenceBasis || '年龄为基于教育年份与工作年份的粗略推断，仅供初筛参考。';
  $('summaryBox').innerHTML = `<strong>${escapeHtml(data.candidateName)}｜${escapeHtml(data.level)}</strong><br>
    大致年龄：<strong>${escapeHtml(ageText)}</strong>${ageConfidence ? `；年龄推断置信度：<strong>${ageConfidence}%</strong>` : ''}<br>
    年龄依据：<span class="muted-line">${escapeHtml(ageBasis)}</span><br>
    综合评分：<strong>${score}/100</strong>；推进建议：<strong>${escapeHtml(data.recommendation)}</strong><br>
    使用模型：<strong>${escapeHtml(data.modelLabel || data.model || 'DeepSeek')}</strong>；严格度：<strong>${escapeHtml(data.strictnessLabel || (data.strictnessLevel ? data.strictnessLevel + '度' : '3度'))}</strong><br>
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

function migrateLeaderboard(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr.map((x) => ({
    ...x,
    jobTitle: x.jobTitle || '历史导入候选人',
    category: x.category || inferCategory(x),
    note: x.note || '',
    createdAt: x.createdAt || new Date().toISOString(),
    weekKey: x.weekKey || getWeekKey(x.createdAt || x.time || new Date()),
    strictnessLevel: x.strictnessLevel || 3,
    strictnessLabel: x.strictnessLabel || '3度｜标准推荐'
  }));
}

function inferCategory(data) {
  const rec = String(data.recommendation || '');
  const score = Number(data.score || 0);
  const confidence = Number(data.confidence || 0);
  if (rec.includes('优先')) return '优先推进';
  if (rec.includes('建议推进')) return '建议推进';
  if (rec.includes('储备')) return '作为储备';
  if (rec.includes('不建议')) return '不建议推进';
  if (score >= 85 && confidence >= 70) return '优先推进';
  if (score >= 75) return '建议推进';
  if (score >= 65) return '待复核';
  return '不建议推进';
}

function getWeekKey(dateValue) {
  const d = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const dayMs = 24 * 60 * 60 * 1000;
  const week = Math.ceil((((d - oneJan) / dayMs) + oneJan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function isCurrentWeek(dateValue) {
  return getWeekKey(dateValue) === getWeekKey(new Date());
}

async function addToLeaderboard(data, showAlert) {
  const standard = getStandardFromForm();
  const now = new Date();
  const item = {
    id: Date.now(),
    candidateName: data.candidateName || data.candidateProfile?.nameFromResume || '待识别',
    candidateAge: data.candidateProfile?.ageEstimate || data.candidateProfile?.ageRange || '待推断',
    candidateAgeRange: data.candidateProfile?.ageRange || '',
    ageConfidence: Number(data.candidateProfile?.ageConfidence || 0),
    ageInferenceBasis: data.candidateProfile?.ageInferenceBasis || '',
    educationTimeline: Array.isArray(data.candidateProfile?.educationTimeline) ? data.candidateProfile.educationTimeline : [],
    firstFullTimeWorkYear: data.candidateProfile?.firstFullTimeWorkYear || '',
    ageWarning: data.candidateProfile?.ageWarning || '',
    score: Number(data.score || 0),
    confidence: Number(data.confidence || 0),
    level: data.level || '',
    recommendation: data.recommendation || '',
    model: data.modelLabel || data.model || 'DeepSeek',
    strictnessLevel: data.strictnessLevel || Number(value('strictnessLevel') || 3),
    strictnessLabel: data.strictnessLabel || (STRICTNESS_TEXT[Number(value('strictnessLevel') || 3)]?.label || '3度｜标准推荐'),
    totalTokens: Number(data.usage?.totalTokens || 0),
    summary: data.summary || '',
    jobTitle: standard.jobTitle || '未命名岗位',
    category: inferCategory(data),
    note: '',
    createdAt: now.toISOString(),
    weekKey: getWeekKey(now),
    time: now.toLocaleString()
  };
  leaderboard.push(item);
  leaderboard.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  await window.resumeApp.saveLeaderboard(leaderboard);
  refreshLeaderboardFilters();
  renderLeaderboard();
  if (showAlert) alert('已加入排行榜。');
}

function refreshLeaderboardFilters() {
  const jobSelect = $('rankJobFilter');
  if (!jobSelect) return;
  const current = jobSelect.value;
  const jobs = Array.from(new Set(leaderboard.map(x => x.jobTitle || '未命名岗位').filter(Boolean))).sort();
  jobSelect.innerHTML = '<option value="">全部岗位</option>' + jobs.map(job => `<option value="${escapeHtml(job)}">${escapeHtml(job)}</option>`).join('');
  if (jobs.includes(current)) jobSelect.value = current;
}

function getFilteredLeaderboard() {
  const job = $('rankJobFilter')?.value || '';
  const category = $('rankCategoryFilter')?.value || '';
  const keyword = ($('rankKeywordFilter')?.value || '').trim().toLowerCase();
  const thisWeek = Boolean($('rankThisWeekOnly')?.checked);

  return leaderboard.filter(x => {
    if (job && (x.jobTitle || '未命名岗位') !== job) return false;
    if (category && (x.category || '') !== category) return false;
    if (thisWeek && !isCurrentWeek(x.createdAt || x.time)) return false;
    if (keyword) {
      const hay = `${x.candidateName || ''} ${x.candidateAge || ''} ${x.ageInferenceBasis || ''} ${x.summary || ''} ${x.note || ''} ${x.jobTitle || ''} ${x.category || ''}`.toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    return true;
  }).sort((a, b) => b.score - a.score || b.confidence - a.confidence);
}

function renderLeaderboard() {
  refreshLeaderboardFilters();
  const body = $('leaderboardBody');
  body.innerHTML = '';
  const list = getFilteredLeaderboard();
  const total = leaderboard.length;
  const summary = $('rankSummary');
  if (summary) {
    const job = $('rankJobFilter')?.value || '全部岗位';
    const category = $('rankCategoryFilter')?.value || '全部归类';
    const week = $('rankThisWeekOnly')?.checked ? '仅本周' : '全部时间';
    summary.textContent = `当前显示 ${list.length} / ${total} 位候选人｜岗位：${job}｜归类：${category}｜时间：${week}`;
  }
  if (!list.length) { body.innerHTML = '<tr><td colspan="10">暂无符合筛选条件的候选人</td></tr>'; return; }
  list.forEach((x, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><span class="rank-num">${index + 1}</span></td>
      <td><strong>${escapeHtml(x.candidateName)}</strong><br><span class="muted-line">大致年龄：${escapeHtml(x.candidateAge || '待推断')}${x.ageConfidence ? `｜年龄置信度 ${Number(x.ageConfidence || 0)}%` : ''}</span><br><span class="muted-line">${escapeHtml(x.summary || '')}</span></td>
      <td><strong>${x.score}</strong><br><span class="muted-line">置信度 ${x.confidence}%</span></td>
      <td><span class="job-pill">${escapeHtml(x.jobTitle || '未命名岗位')}</span></td>
      <td>
        <select class="rank-select" data-category="${x.id}">
          ${['优先推进','建议推进','待复核','作为储备','不建议推进','已联系','已面试','已淘汰'].map(c => `<option value="${c}" ${String(x.category || '') === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </td>
      <td>${escapeHtml(x.model || '-')}<br><span class="muted-line">${escapeHtml(x.strictnessLabel || '3度｜标准推荐')}</span><br><span class="muted-line">${Number(x.totalTokens || 0)} Token</span></td>
      <td><textarea class="rank-note" data-note="${x.id}" placeholder="添加候选人备注、沟通进展、风险说明……">${escapeHtml(x.note || '')}</textarea></td>
      <td>${escapeHtml(x.time || '')}<br><span class="muted-line">${escapeHtml(x.weekKey || '')}</span></td>
      <td><button class="danger small" data-del="${x.id}">删除</button></td>`;
    body.appendChild(tr);
  });

  body.querySelectorAll('[data-category]').forEach(select => select.onchange = async () => {
    const item = leaderboard.find(x => String(x.id) === String(select.dataset.category));
    if (item) {
      item.category = select.value;
      await window.resumeApp.saveLeaderboard(leaderboard);
      renderLeaderboard();
    }
  });

  body.querySelectorAll('[data-note]').forEach(area => area.onchange = async () => {
    const item = leaderboard.find(x => String(x.id) === String(area.dataset.note));
    if (item) {
      item.note = area.value.trim();
      await window.resumeApp.saveLeaderboard(leaderboard);
      renderLeaderboard();
    }
  });

  body.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
    leaderboard = leaderboard.filter(x => String(x.id) !== String(btn.dataset.del));
    await window.resumeApp.saveLeaderboard(leaderboard);
    renderLeaderboard();
  });
}

function resetLeaderboardFilters() {
  if ($('rankJobFilter')) $('rankJobFilter').value = '';
  if ($('rankCategoryFilter')) $('rankCategoryFilter').value = '';
  if ($('rankKeywordFilter')) $('rankKeywordFilter').value = '';
  if ($('rankThisWeekOnly')) $('rankThisWeekOnly').checked = false;
  renderLeaderboard();
}

async function clearLeaderboard() {
  if (!confirm('确定清空排行榜吗？')) return;
  leaderboard = [];
  await window.resumeApp.clearLeaderboard();
  renderLeaderboard();
}

function exportCSV() {
  const list = getFilteredLeaderboard();
  if (!list.length) return alert('当前筛选结果为空。');
  const rows = [['排名','候选人','大致年龄','年龄推断置信度','年龄推断依据','岗位','归类','备注','分数','置信度','模型','严格度','Token','等级','建议','周次','时间','摘要'], ...list.map((x, i) => [i+1, x.candidateName, x.candidateAge || '', x.ageConfidence || '', x.ageInferenceBasis || '', x.jobTitle || '', x.category || '', x.note || '', x.score, x.confidence, x.model || '', x.strictnessLabel || '', x.totalTokens || 0, x.level, x.recommendation, x.weekKey || '', x.time, x.summary])];
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const job = $('rankJobFilter')?.value || 'all-jobs';
  a.href = url; a.download = `candidate_leaderboard_${job}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}


async function exportBackup() {
  hideMessages(['backupSuccess', 'backupError']);
  setStatus('backupStatus', '正在准备导出完整备份……');

  const includeApiKey = Boolean($('includeApiKeyBackup')?.checked);
  if (includeApiKey) {
    const ok = confirm('你选择了导出 API Key。备份文件将包含敏感信息，请不要发给别人。确定继续吗？');
    if (!ok) {
      setStatus('backupStatus', '已取消导出。');
      return;
    }
  }

  try {
    const result = await window.resumeApp.exportBackup({ includeApiKey });
    if (result?.canceled) {
      setStatus('backupStatus', '已取消导出。');
      return;
    }

    show(
      'backupSuccess',
      `备份已导出：${result.filePath}。排行榜记录 ${result.leaderboardCount || 0} 条，岗位标准：${result.hasStandard ? '已包含' : '未保存'}，API Key：${result.apiKeyIncluded ? '已包含' : '未包含'}。`
    );
    setStatus('backupStatus', '');
  } catch (err) {
    setStatus('backupStatus', '');
    show('backupError', err.message || String(err));
  }
}

async function importBackup() {
  hideMessages(['backupSuccess', 'backupError']);

  const ok = confirm('导入备份会覆盖当前岗位标准、排行榜和部分本地设置。若备份文件不包含 API Key，系统会保留当前电脑已保存的 API Key。确定继续吗？');
  if (!ok) return;

  setStatus('backupStatus', '正在导入备份……');

  try {
    const result = await window.resumeApp.importBackup();
    if (result?.canceled) {
      setStatus('backupStatus', '已取消导入。');
      return;
    }

    await initApp();

    show(
      'backupSuccess',
      `备份导入完成。排行榜记录 ${result.leaderboardCount || 0} 条，岗位标准：${result.hasStandard ? '已恢复' : '未包含'}，API Key：${result.apiKeyImported ? '已导入' : (result.apiKeyPreserved ? '已保留当前电脑原 Key' : '未包含')}。`
    );
    setStatus('backupStatus', '');
  } catch (err) {
    setStatus('backupStatus', '');
    show('backupError', err.message || String(err));
  }
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
