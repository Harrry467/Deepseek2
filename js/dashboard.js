````javascript
const CLAUDE_API = 'https://api.anthropic.com/v1/messages';

let practiceData = null;
let hintVisible = [false, false, false];

// ======================================================
// AUTH / LOGIN
// ======================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupDifficultySlider();
  setupTabs();
  setupGenerateQuestions();
  setupExplainFeature();
  await setupAuth();
});

async function setupAuth() {
  const loginBtn = document.getElementById('loginLogoutBtn');

  try {
    const user = await getCurrentUser();

    if (user) {
      loginBtn.textContent = 'Logout';
      loginBtn.href = '#';

      loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await logout();
        window.location.href = 'index.html';
      });
    } else {
      loginBtn.textContent = 'Login';
      loginBtn.href = 'login.html';
    }
  } catch (err) {
    console.error('Auth error:', err);
  }
}

// ======================================================
// TAB SWITCHING
// ======================================================
function setupTabs() {
  const generateBtn = document.getElementById('tabBtnGenerate');
  const explainBtn = document.getElementById('tabBtnExplain');

  generateBtn.addEventListener('click', () => switchTab('generate'));
  explainBtn.addEventListener('click', () => switchTab('explain'));
}

function switchTab(tab) {
  document.getElementById('panelGenerate')
    .classList.toggle('active', tab === 'generate');

  document.getElementById('panelExplain')
    .classList.toggle('active', tab === 'explain');

  document.getElementById('tabBtnGenerate')
    .classList.toggle('active', tab === 'generate');

  document.getElementById('tabBtnExplain')
    .classList.toggle('active', tab === 'explain');
}

// ======================================================
// DIFFICULTY SLIDER
// ======================================================
function setupDifficultySlider() {
  const slider = document.getElementById('difficulty');
  const value = document.getElementById('difficultyValue');

  if (!slider || !value) return;

  slider.addEventListener('input', () => {
    value.textContent = slider.value;
  });
}

// ======================================================
// GENERATE QUESTIONS
// ======================================================
function setupGenerateQuestions() {
  const generateBtn = document.getElementById('generateBtn');
  const clearBtn = document.getElementById('clearBtn');
  const submitBtn = document.getElementById('submitAnswersBtn');

  if (generateBtn) {
    generateBtn.addEventListener('click', generateQuestions);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearQuestions);
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', submitAnswers);
  }
}

async function generateQuestions() {
  const subject = document.getElementById('subject').value;
  const topic = document.getElementById('topic').value;
  const level = document.getElementById('level').value;
  const difficulty = document.getElementById('difficulty').value;
  const numQuestions = document.getElementById('numQuestions').value;

  const loading = document.getElementById('loading');
  const panel = document.getElementById('questionsPanel');
  const list = document.getElementById('questionsList');
  const placeholder = document.getElementById('placeholderMessage');

  loading.classList.remove('hidden');
  panel.classList.remove('hidden');

  try {
    const prompt = `
Generate ${numQuestions} ${level} ${subject} questions on ${topic}.
Difficulty level: ${difficulty}/10.

Return ONLY valid JSON:

{
  "questions": [
    {
      "question": "Question text",
      "answer": "Answer"
    }
  ]
}
`;

    const response = await callClaude(prompt);
    const parsed = JSON.parse(cleanResponse(response));

    list.innerHTML = '';
    placeholder.style.display = 'none';

    parsed.questions.forEach((q, index) => {
      const html = `
        <div class="question-item">
          <div class="question-text">
            ${index + 1}. ${q.question}
          </div>

          <textarea
            class="answer-input"
            placeholder="Write your answer..."
            data-answer="${q.answer}"
          ></textarea>

          <div class="feedback-item hidden"></div>
        </div>
      `;

      list.insertAdjacentHTML('beforeend', html);
    });

  } catch (err) {
    console.error(err);
    alert('Failed to generate questions.');
  }

  loading.classList.add('hidden');
}

function clearQuestions() {
  document.getElementById('questionsList').innerHTML = '';
  document.getElementById('placeholderMessage').style.display = 'block';
}

function submitAnswers() {
  const textareas = document.querySelectorAll('.answer-input');

  textareas.forEach((textarea) => {
    const correct = textarea.dataset.answer;
    const userAnswer = textarea.value.trim();

    const feedback =
      textarea.parentElement.querySelector('.feedback-item');

    feedback.classList.remove('hidden');

    if (
      userAnswer.toLowerCase() ===
      correct.toLowerCase()
    ) {
      feedback.innerHTML =
        '✅ Correct!';
    } else {
      feedback.innerHTML =
        `❌ Correct answer: ${correct}`;
    }
  });
}

// ======================================================
// EXPLAIN FEATURE
// ======================================================
function setupExplainFeature() {
  const explainBtn =
    document.getElementById('explainBtn');

  const practiceBtn =
    document.getElementById('startPracticeBtn');

  explainBtn?.addEventListener(
    'click',
    explainTopic
  );

  practiceBtn?.addEventListener(
    'click',
    generatePracticeQuestions
  );
}

async function explainTopic() {
  const topic =
    document.getElementById('topicInput')
      .value.trim();

  if (!topic) return;

  const btn =
    document.getElementById('explainBtn');

  btn.disabled = true;
  btn.innerHTML =
    `<span class="spinner"></span> Thinking...`;

  const panel =
    document.getElementById('explanationPanel');

  const content =
    document.getElementById('explanationContent');

  panel.classList.remove('show');
  content.innerHTML = skeletonLines(5);

  try {
    const result = await callClaude(`
Explain this topic simply for a student:

"${topic}"

Keep it concise and easy to understand.
`);

    content.textContent = result;
    panel.classList.add('show');

  } catch (err) {
    content.textContent =
      'Something went wrong.';
    panel.classList.add('show');
  }

  btn.disabled = false;
  btn.innerHTML =
    `<i class="fas fa-magic"></i> Explain it`;
}

async function generatePracticeQuestions() {
  alert('Practice generation connected.');
}

// ======================================================
// HELPERS
// ======================================================
async function callClaude(prompt) {
  const response = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
      'AI request failed'
    );
  }

  return data.content
    ?.map(x => x.text || '')
    .join('') || '';
}

function cleanResponse(text) {
  return text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
}

function skeletonLines(n) {
  return Array.from(
    { length: n },
    (_, i) =>
      `<div class="skeleton-line"
      style="width:${85 - i * 10}%"></div>`
  ).join('');
}
````
