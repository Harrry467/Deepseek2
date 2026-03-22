// js/dashboard.js
// This script assumes the DOM elements exist and that questions.js is loaded.

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const subjectSelect = document.getElementById('subject');
    const topicSelect = document.getElementById('topic');
    const levelSelect = document.getElementById('level');
    const generateBtn = document.getElementById('generateBtn');
    const questionSpan = document.getElementById('questionText');
    const answerTextarea = document.getElementById('answerInput');
    const submitBtn = document.getElementById('submitBtn');
    const feedbackDiv = document.getElementById('feedback');
    const customQuestionTextarea = document.getElementById('customQuestion');
    const customModelAnswerTextarea = document.getElementById('customModelAnswer');
    const setCustomBtn = document.getElementById('setCustomBtn');

    // State
    let currentQuestionText = "";
    let customMode = false;
    let customModelHint = "";

    // Initial update of topics (from questions.js)
    if (typeof updateTopics === 'function') updateTopics();

    // Function to generate random question
    function generateRandomQuestion() {
        const subject = subjectSelect.value;
        const topic = topicSelect.value;
        const level = levelSelect.value;
        const q = getRandomQuestion(subject, topic, level);
        currentQuestionText = q;
        questionSpan.innerText = q;
        customMode = false;
        customModelHint = "";
        answerTextarea.value = "";
        feedbackDiv.classList.add('hidden');
    }

    // Function to set custom question
    function setCustomQuestion() {
        const customQ = customQuestionTextarea.value.trim();
        if (!customQ) {
            alert('Please enter a custom question.');
            return;
        }
        currentQuestionText = customQ;
        customMode = true;
        customModelHint = customModelAnswerTextarea.value.trim();
        questionSpan.innerText = customQ;
        answerTextarea.value = "";
        feedbackDiv.classList.add('hidden');
    }

    // Event listeners
    generateBtn.addEventListener('click', generateRandomQuestion);
    setCustomBtn.addEventListener('click', setCustomQuestion);
    subjectSelect.addEventListener('change', () => {
        if (typeof updateTopics === 'function') updateTopics();
        generateRandomQuestion();
    });
    topicSelect.addEventListener('change', generateRandomQuestion);
    levelSelect.addEventListener('change', generateRandomQuestion);

    // Submit for marking
    submitBtn.addEventListener('click', async () => {
        const question = currentQuestionText;
        const userAnswer = answerTextarea.value.trim();
        if (!question || question === 'Click "Generate Question" to start') {
            alert('Please generate or upload a question first.');
            return;
        }
        if (!userAnswer) {
            alert('Please write your answer.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Marking...';

        try {
            const response = await fetch('/api/mark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: question,
                    userAnswer: userAnswer,
                    modelAnswerHint: customMode ? customModelHint : ''
                })
            });
            const data = await response.json();
            if (response.ok) {
                displayFeedback(data);
            } else {
                alert('Error: ' + (data.error || 'Something went wrong'));
            }
        } catch (err) {
            console.error(err);
            alert('Network error. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Submit for Marking';
        }
    });

    function displayFeedback(result) {
        feedbackDiv.innerHTML = `
            <div class="score">Score: ${result.score}/10</div>
            <h3>✅ Strengths</h3>
            <ul>${result.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
            <h3>📝 Areas to Improve</h3>
            <ul>${result.improvements.map(i => `<li>${i}</li>`).join('')}</ul>
        `;
        feedbackDiv.classList.remove('hidden');
    }

    // Initial random question
    generateRandomQuestion();
});
