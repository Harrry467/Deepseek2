// js/dashboard.js
// Calls your own backend API routes (which use DeepSeek).
// The old prototype code that called api.anthropic.com directly
// from the browser has been removed — it had no API key and
// always failed with a 401.

let sessionId = null;
let questionIds = [];
let questions = [];

// ======================================================
// INIT
// ======================================================
document.addEventListener('DOMContentLoaded', async () => {
  await setupAuth();
  setupDifficultySlider();
  setupTabs();
  setupGenerateQuestions();
  setupExplainFeature();
});

// ======================================================
// AUTH
// ======================================================
async function setupAuth() {
  const loginBtn = document.getElementById('loginLogoutBtn');
  if (!loginBtn) return;

  try {
    const user = await getCurrentUser();

    if (user) {
      loginBtn.textContent = 'Logout';
      loginBtn.href = '#';

      loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await logout();
        // logout() in auth.js already redirects — no double redirect needed
      });
    } else {
      loginBtn.textContent = 'Login';
      loginBtn.href = 'login.html';
    }
  } catch (err) {
    console.error('Auth setup error:', err);
  }
}

// ======================================================
// TAB SWITCHING
// ======================================================
function setupTabs() {
  const generateBtn = document.getElementById('tabBtnGenerate');
  const explainBtn  = document.getElementById('tabBtnExplain');

  generateBtn?.addEventListener('click', () => switchTab('generate'));
  explainBtn?.addEventListener('click',  () => switchTab('explain'));
}

function switchTab(tab) {
  document.getElementById('panelGenerate')?.classList.toggle('active', tab === 'generate');
  document.getElementById('panelExplain')?.classList.toggle('active',  tab === 'explain');
  document.getElementById('tabBtnGenerate')?.classList.toggle('active', tab === 'generate');
  document.getElementById('tabBtnExplain')?.classList.toggle('active',  tab === 'explain');
}

// ======================================================
// DIFFICULTY SLIDER
// ======================================================
function setupDifficultySlider() {
  const slider = document.getElementById('difficulty');
  const label  = document.getElementById('difficultyValue');
  if (!slider || !label) return;
  slider.addEventListener('input', () => { label.textContent = slider.value; });
}

// ======================================================
// GENERATE QUESTIONS
// ======================================================
function setupGenerateQuestions() {
  document.getElementById('generateBtn')?.addEventListener('click', generateQuestions);
  document.getElementById('clearBtn')?.addEventListener('click', clearQuestions);
  document.getElementById('submitAnswersBtn')?.addEventListener('click', submitAnswers);
}

async function generateQuestions() {
  const subject      = document.getElementById('subject')?.value?.trim();
  const topic        = document.getElementById('topic')?.value?.trim();
  const level        = document.getElementById('level')?.value;
  const difficulty   = document.getElementById('difficulty')?.value;
  const numQuestions = document.getElementById('numQuestions')?.value;

  if (!subject || !topic) {
    showError('Please enter a subject and topic.');
    return;
  }

  const generateBtn   = document.getElementById('generateBtn');
  const loading       = document.getElementById('loading');
  const panel         = document.getElementById('questionsPanel');
  const list          = document.getElementById('questionsList');
  const placeholder   = document.getElementById('placeholderMessage');
  const submitBtn     = document.getElementById('submitAnswersBtn');

  generateBtn.disabled = true;
  if (submitBtn) submitBtn.disabled = true;
  loading?.classList.remove('hidden');
  panel?.classList.remove('hidden');
  list.innerHTML = '';

  try {
    const authHeader = await getAuthHeader();

    const res = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ subject, topic, level, difficulty, numQuestions })
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('Server returned an invalid response. Please try again.');
    }

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to generate questions.');
    }

    // Store session state for batch marking
    sessionId   = data.sessionId   || null;
    questionIds = data.questionIds || [];
    questions   = data.questions   || [];

    if (questions.length === 0) {
      throw new Error('No questions were returned. Please try again.');
    }

    if (placeholder) placeholder.style.display = 'none';

    questions.forEach((q, i) => {
      list.insertAdjacentHTML('beforeend', `
        <div class="question-item" data-index="${i}">
          <div class="question-text">${i + 1}. ${escapeHtml(q)}</div>
          <textarea
            class="answer-input"
            placeholder="Write your answer here..."
            rows="4"
          ></textarea>
          <div class="feedback-item hidden"></div>
        </div>
      `);
    });

    if (submitBtn) submitBtn.disabled = false;

  } catch (err) {
    console.error('generateQuestions error:', err);
    showError(err.message || 'Something went wrong. Please try again.');
    if (placeholder) placeholder.style.display = 'block';
  } finally {
    generateBtn.disabled = false;
    loading?.classList.add('hidden');
  }
}

function clearQuestions() {
  document.getElementById('questionsList').innerHTML = '';
  const placeholder = document.getElementById('placeholderMessage');
  if (placeholder) placeholder.style.display = 'block';
  sessionId   = null;
  questionIds = [];
  questions   = [];
  const submitBtn = document.getElementById('submitAnswersBtn');
  if (submitBtn) submitBtn.disabled = true;
}

async function submitAnswers() {
  const items = document.querySelectorAll('.question-item');
  if (items.length === 0) return;

  const answers = Array.from(items).map(item =>
    item.querySelector('.answer-input')?.value?.trim() || ''
  );

  const unanswered = answers.filter(a => a.length === 0).length;
  if (unanswered > 0) {
    if (!confirm(`${unanswered} question(s) have no answer. Submit anyway?`)) return;
  }

  const submitBtn = document.getElementById('submitAnswersBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Marking…';
  }

  try {
    const authHeader = await getAuthHeader();

    const res = await fetch('/api/mark-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        questions,
        answers,
        questionIds,
        sessionId
      })
    });

    let results;
    try {
      results = await res.json();
    } catch {
      throw new Error('Server returned an invalid response.');
    }

    if (!res.ok) {
      throw new Error(results?.error || 'Marking failed.');
    }

    if (!Array.isArray(results)) {
      throw new Error('Unexpected response format from marking API.');
    }

    items.forEach((item, i) => {
      const result   = results[i] || {};
      const feedback = item.querySelector('.feedback-item');
      if (!feedback) return;

      const score       = typeof result.score === 'number' ? result.score : '–';
      const strengths   = Array.isArray(result.strengths)    ? result.strengths    : [];
      const improvements = Array.isArray(result.improvements) ? result.improvements : [];

      feedback.classList.remove('hidden');
      feedback.innerHTML = `
        <div class="feedback-score">Score: ${score}/10</div>
        ${strengths.length ? `
          <div class="feedback-section">
            <strong>Strengths</strong>
            <ul>${strengths.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
          </div>` : ''}
        ${improvements.length ? `
          <div class="feedback-section">
            <strong>Areas to improve</strong>
            <ul>${improvements.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
          </div>` : ''}
      `;
    });

  } catch (err) {
    console.error('submitAnswers error:', err);
    showError(err.message || 'Marking failed. Please try again.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit answers';
    }
  }
}

// ======================================================
// EXPLAIN FEATURE
// ======================================================
function setupExplainFeature() {
  document.getElementById('explainBtn')?.addEventListener('click', explainTopic);
  document.getElementById('startPracticeBtn')?.addEventListener('click', generatePracticeQuestions);
}

async function explainTopic() {
  const topicInput = document.getElementById('topicInput');
  const topic = topicInput?.value?.trim();
  if (!topic) return;

  const btn     = document.getElementById('explainBtn');
  const panel   = document.getElementById('explanationPanel');
  const content = document.getElementById('explanationContent');

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Thinking…';
  panel?.classList.remove('show');
  if (content) content.innerHTML = skeletonLines(5);

  try {
    const authHeader = await getAuthHeader();

    const res = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ topic })
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('Server returned an invalid response.');
    }

    if (!res.ok) {
      throw new Error(data?.error || 'Could not get an explanation.');
    }

    if (content) content.textContent = data.explanation || 'No explanation returned.';
    panel?.classList.add('show');

  } catch (err) {
    console.error('explainTopic error:', err);
    if (content) content.textContent = err.message || 'Something went wrong.';
    panel?.classList.add('show');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> Explain it';
  }
}

async function generatePracticeQuestions() {
  const topicInput = document.getElementById('topicInput');
  const topic = topicInput?.value?.trim();
  if (!topic) {
    showError('Please enter a topic first.');
    return;
  }

  const btn = document.getElementById('startPracticeBtn');
  if (btn) {
    btn.disabled  = true;
    btn.textContent = 'Generating…';
  }

  try {
    const authHeader = await getAuthHeader();

    const res = await fetch('/api/explain-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ topic })
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('Server returned an invalid response.');
    }

    if (!res.ok) throw new Error(data?.error || 'Failed to generate practice questions.');

    // Switch to the generate tab and populate the list with the returned questions
    switchTab('generate');
    const list        = document.getElementById('questionsList');
    const placeholder = document.getElementById('placeholderMessage');
    if (placeholder) placeholder.style.display = 'none';
    if (list) list.innerHTML = '';

    questions   = (data.questions || []).map(q => q.question);
    questionIds = [];
    sessionId   = null;

    (data.questions || []).forEach((q, i) => {
      list?.insertAdjacentHTML('beforeend', `
        <div class="question-item" data-index="${i}">
          <div class="question-text">${i + 1}. ${escapeHtml(q.question)}</div>
          <textarea class="answer-input" placeholder="Write your answer here…" rows="4"></textarea>
          <div class="feedback-item hidden"></div>
        </div>
      `);
    });

    const submitBtn = document.getElementById('submitAnswersBtn');
    if (submitBtn) submitBtn.disabled = false;

  } catch (err) {
    console.error('generatePracticeQuestions error:', err);
    showError(err.message || 'Something went wrong.');
  } finally {
    if (btn) {
      btn.disabled    = false;
      btn.textContent = 'Practice this topic';
    }
  }
}

// ======================================================
// HELPERS
// ======================================================
function skeletonLines(n) {
  return Array.from({ length: n }, (_, i) =>
    `<div class="skeleton-line" style="width:${85 - i * 10}%"></div>`
  ).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showError(message) {
  const el = document.getElementById('errorMessage');
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
  } else {
    alert(message);
  }
}
