// script.js
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const subjectSelect = document.getElementById('subject');
  const topicSelect = document.getElementById('topic');
  const levelSelect = document.getElementById('level');
  const generateBtn = document.getElementById('generateBtn');
  const questionText = document.getElementById('questionText');
  const answerInput = document.getElementById('answerInput');
  const submitBtn = document.getElementById('submitBtn');
  const feedbackDiv = document.getElementById('feedback');
  const customQuestion = document.getElementById('customQuestion');
  const customModelAnswer = document.getElementById('customModelAnswer');
  const setCustomBtn = document.getElementById('setCustomBtn');

  // Question bank (mock data)
  const questionBank = {
    maths: {
      topics: ['algebra', 'calculus', 'geometry'],
      KS3: {
        algebra: 'Solve for x: 2x + 5 = 15',
        calculus: 'What is the derivative of x²?',
        geometry: 'What is the area of a circle with radius 4?'
      },
      GCSE: {
        algebra: 'Factorise x² + 5x + 6',
        calculus: 'Find dy/dx of y = 3x² - 2x + 1',
        geometry: 'Calculate the volume of a cylinder radius 3, height 5'
      },
      ALevel: {
        algebra: 'Solve the quadratic equation 2x² - 5x - 3 = 0',
        calculus: 'Integrate ∫(3x² + 2x) dx',
        geometry: 'Prove that the angle in a semicircle is 90°'
      }
    },
    physics: {
      topics: ['mechanics', 'electricity', 'waves'],
      KS3: {
        mechanics: 'What is the formula for speed?',
        electricity: 'What is a conductor?',
        waves: 'What is frequency?'
      },
      GCSE: {
        mechanics: 'Calculate kinetic energy of a 2kg mass at 3m/s',
        electricity: 'Ohm\'s law: V = ?',
        waves: 'What is the wave equation?'
      },
      ALevel: {
        mechanics: 'Derive the SUVAT equations',
        electricity: 'Kirchhoff\'s first law',
        waves: 'Explain diffraction grating'
      }
    },
    chemistry: {
      topics: ['bonding', 'reactions', 'periodic-table'],
      KS3: {
        bonding: 'What is an atom?',
        reactions: 'What is a chemical reaction?',
        'periodic-table': 'Name two noble gases'
      },
      GCSE: {
        bonding: 'Describe ionic bonding',
        reactions: 'What is a catalyst?',
        'periodic-table': 'What are halogens?'
      },
      ALevel: {
        bonding: 'Explain molecular orbital theory',
        reactions: 'What is activation energy?',
        'periodic-table': 'Discuss periodic trends in electronegativity'
      }
    },
    biology: {
      topics: ['cells', 'genetics', 'ecology'],
      KS3: {
        cells: 'What is the function of the nucleus?',
        genetics: 'What is DNA?',
        ecology: 'Define habitat'
      },
      GCSE: {
        cells: 'Differences between plant and animal cells',
        genetics: 'What is a gene?',
        ecology: 'What is a food web?'
      },
      ALevel: {
        cells: 'Describe the structure of mitochondria',
        genetics: 'Explain the process of transcription',
        ecology: 'Discuss the nitrogen cycle'
      }
    },
    english: {
      topics: ['literature', 'writing', 'language'],
      KS3: {
        literature: 'What is a metaphor?',
        writing: 'Write a persuasive sentence about school',
        language: 'What is alliteration?'
      },
      GCSE: {
        literature: 'Analyze the character of Macbeth',
        writing: 'How to structure a persuasive essay',
        language: 'Identify the effects of personification'
      },
      ALevel: {
        literature: 'Discuss the themes in "The Handmaid\'s Tale"',
        writing: 'Analyze the use of narrative voice',
        language: 'Explain the concept of sociolect'
      }
    }
  };

  // Helper: update topics dropdown based on subject
  function updateTopics() {
    const subject = subjectSelect.value;
    const topics = questionBank[subject]?.topics || [];
    topicSelect.innerHTML = '';
    topics.forEach(topic => {
      const option = document.createElement('option');
      option.value = topic;
      option.textContent = topic.charAt(0).toUpperCase() + topic.slice(1);
      topicSelect.appendChild(option);
    });
    // if no topics, add a placeholder
    if (topics.length === 0) {
      const option = document.createElement('option');
      option.value = 'general';
      option.textContent = 'General';
      topicSelect.appendChild(option);
    }
    // regenerate a question after topic update
    generateQuestion();
  }

  // Generate random question based on selections
  function generateQuestion() {
    const subject = subjectSelect.value;
    const topic = topicSelect.value;
    const level = levelSelect.value;
    const bank = questionBank[subject];
    if (!bank) {
      questionText.innerText = 'Question bank not available for this subject.';
      return;
    }
    const levelBank = bank[level];
    if (!levelBank) {
      questionText.innerText = 'No questions available for this level.';
      return;
    }
    const question = levelBank[topic];
    if (question) {
      questionText.innerText = question;
    } else {
      // fallback: pick first available topic's question
      const firstTopic = Object.keys(levelBank)[0];
      questionText.innerText = levelBank[firstTopic] || 'No question found.';
    }
    // Clear previous feedback and answer
    answerInput.value = '';
    feedbackDiv.classList.add('hidden');
    // Reset custom flag
    currentQuestionIsCustom = false;
    customModelAnswerValue = '';
  }

  // Mock AI marking
  function mockAIMarking(question, userAnswer, modelAnswerHint = '') {
    // Simple simulation: analyse answer length and keyword matching
    const keywords = question.toLowerCase().split(/\W+/).filter(word => word.length > 3);
    const userLower = userAnswer.toLowerCase();
    let matchedKeywords = keywords.filter(k => userLower.includes(k)).length;
    let lengthBonus = Math.min(3, userAnswer.length / 50);
    let score = 4 + matchedKeywords + lengthBonus;
    if (modelAnswerHint) {
      // Compare to model answer (simple word overlap)
      const modelWords = modelAnswerHint.toLowerCase().split(/\W+/);
      const userWords = userLower.split(/\W+/);
      const overlap = modelWords.filter(w => userWords.includes(w)).length;
      score += overlap;
    }
    score = Math.min(10, Math.max(0, Math.round(score)));
    
    // Generate strengths and improvements
    const strengths = [];
    const improvements = [];
    if (userAnswer.length > 30) strengths.push('Provided a detailed answer.');
    else strengths.push('Attempted the question.');
    if (matchedKeywords >= 2) strengths.push('Used relevant terminology correctly.');
    if (lengthBonus >= 2) strengths.push('Elaborated well on key points.');
    if (strengths.length < 3) strengths.push('Showed understanding of the topic.');
    
    if (userAnswer.length < 20) improvements.push('Provide more explanation to improve clarity.');
    if (matchedKeywords === 0) improvements.push('Incorporate key terms from the question.');
    if (score < 6) improvements.push('Review the core concepts and try again.');
    if (improvements.length < 3) improvements.push('Check your work for any missing steps.');
    
    // Ensure exactly 3 strengths and 3 improvements
    while (strengths.length < 3) strengths.push('Keep practicing, you\'re on the right track!');
    while (improvements.length < 3) improvements.push('Try to structure your answer with bullet points.');
    
    return { score, strengths, improvements };
  }

  // Handle submission
  function handleSubmit() {
    const question = questionText.innerText;
    const answer = answerInput.value.trim();
    if (!question || question === 'Click "Generate Question" to start') {
      alert('Please generate a question first.');
      return;
    }
    if (!answer) {
      alert('Please enter an answer.');
      return;
    }
    // Use custom model answer if set
    const modelHint = currentQuestionIsCustom ? customModelAnswerValue : '';
    const { score, strengths, improvements } = mockAIMarking(question, answer, modelHint);
    
    // Build feedback HTML
    feedbackDiv.innerHTML = `
      <div class="score">Score: ${score}/10</div>
      <h4>✅ Strengths</h4>
      <ul>${strengths.map(s => `<li>${s}</li>`).join('')}</ul>
      <h4>📝 Areas to Improve</h4>
      <ul>${improvements.map(i => `<li>${i}</li>`).join('')}</ul>
    `;
    feedbackDiv.classList.remove('hidden');
  }

  // Custom question handling
  let currentQuestionIsCustom = false;
  let customModelAnswerValue = '';
  
  function setCustomQuestion() {
    const customQ = customQuestion.value.trim();
    if (!customQ) {
      alert('Please enter a custom question.');
      return;
    }
    questionText.innerText = customQ;
    customModelAnswerValue = customModelAnswer.value.trim();
    currentQuestionIsCustom = true;
    answerInput.value = '';
    feedbackDiv.classList.add('hidden');
    alert('Custom question loaded! You can now answer it.');
  }

  // Event listeners
  subjectSelect.addEventListener('change', updateTopics);
  topicSelect.addEventListener('change', generateQuestion);
  levelSelect.addEventListener('change', generateQuestion);
  generateBtn.addEventListener('click', () => {
    if (currentQuestionIsCustom) {
      // if we are in custom mode, reset to normal random generation
      currentQuestionIsCustom = false;
      customModelAnswerValue = '';
    }
    generateQuestion();
  });
  submitBtn.addEventListener('click', handleSubmit);
  setCustomBtn.addEventListener('click', setCustomQuestion);
  
  // Initial load
  updateTopics();
});
