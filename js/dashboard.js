// js/dashboard.js
document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const clearBtn = document.getElementById('clearBtn');
  const questionsPanel = document.getElementById('questionsPanel');
  const questionsList = document.getElementById('questionsList');
  const placeholderMessage = document.getElementById('placeholderMessage');
  const loadingDiv = document.getElementById('loading');
  const submitAnswersBtn = document.getElementById('submitAnswersBtn');

  let currentQuestions = []; // array of question strings
  let answers = []; // array of user answers (parallel)

  function setLoading(show) {
    if (show) {
      loadingDiv.classList.remove('hidden');
      questionsPanel.classList.add('hidden');
    } else {
      loadingDiv.classList.add('hidden');
    }
  }

  // Render the list of questions with answer textareas
  function renderQuestions() {
    if (!currentQuestions.length) {
      questionsList.innerHTML = '';
      placeholderMessage.classList.remove('hidden');
      return;
    }
    placeholderMessage.classList.add('hidden');
    questionsList.innerHTML = '';
    currentQuestions.forEach((q, idx) => {
      const div = document.createElement('div');
      div.className = 'question-item';
      div.innerHTML = `
        <div class="question-text">${idx+1}. ${q}</div>
        <textarea class="answer-input" data-idx="${idx}" rows="3" placeholder="Type your answer here...">${answers[idx] || ''}</textarea>
        <div id="feedback-${idx}" class="feedback-item hidden"></div>
      `;
      questionsList.appendChild(div);
    });

    // Attach input listeners to update answers array
    document.querySelectorAll('.answer-input').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        answers[idx] = e.target.value;
      });
    });
  }

  // Generate questions via backend
  generateBtn.addEventListener('click', async () => {
    const subject = document.getElementById('subject').value.trim();
    const topic = document.getElementById('topic').value.trim();
    const level = document.getElementById('level').value;
    const difficulty = parseInt(document.getElementById('difficulty').value);
    const numQuestions = parseInt(document.getElementById('numQuestions').value);

    if (!subject || !topic) {
      alert('Please fill in both subject and topic.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, topic, level, difficulty, numQuestions })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate questions');

      currentQuestions = data.questions; // array of strings
      answers = new Array(currentQuestions.length).fill('');

      renderQuestions();
      questionsPanel.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      alert('Error generating questions: ' + err.message);
    } finally {
      setLoading(false);
    }
  });

  // Clear everything
  clearBtn.addEventListener('click', () => {
    currentQuestions = [];
    answers = [];
    renderQuestions(); // this will show the placeholder
    // Optionally reset form fields
    document.getElementById('subject').value = 'Mathematics';
    document.getElementById('topic').value = 'Algebra';
    document.getElementById('level').value = 'KS3';
    document.getElementById('difficulty').value = '5';
    document.getElementById('difficultyValue').textContent = '5';
    document.getElementById('numQuestions').value = '5';
  });

  // Submit all answers for marking
  submitAnswersBtn.addEventListener('click', async () => {
    if (currentQuestions.length === 0) {
      alert('No questions to submit. Generate some questions first.');
      return;
    }
    // Check if any answer is empty
    const emptyIndex = answers.findIndex(a => !a.trim());
    if (emptyIndex !== -1) {
      alert(`Please answer question ${emptyIndex+1} before submitting.`);
      return;
    }

    submitAnswersBtn.disabled = true;
    submitAnswersBtn.textContent = 'Marking...';

    try {
      const response = await fetch('/api/mark-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: currentQuestions,
          answers: answers
        })
      });
      const results = await response.json();
      if (!response.ok) throw new Error(results.error || 'Marking failed');

      // Display feedback for each question
      results.forEach((result, idx) => {
        const feedbackDiv = document.getElementById(`feedback-${idx}`);
        if (feedbackDiv) {
          feedbackDiv.innerHTML = `
            <div class="score">Score: ${result.score}/10</div>
            <strong>Strengths:</strong>
            <ul>${result.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
            <strong>Areas to improve:</strong>
            <ul>${result.improvements.map(i => `<li>${i}</li>`).join('')}</ul>
          `;
          feedbackDiv.classList.remove('hidden');
        }
      });
    } catch (err) {
      console.error(err);
      alert('Error marking answers: ' + err.message);
    } finally {
      submitAnswersBtn.disabled = false;
      submitAnswersBtn.textContent = 'Submit Answers';
    }
  });
});
