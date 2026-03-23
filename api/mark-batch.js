// api/mark-batch.js
const { extractJSON, checkRateLimit } = require('../utils/ai');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authentication
  const userEmail = req.headers['x-user-email'];
  if (!userEmail) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Rate limiting (per user)
  if (!checkRateLimit(userEmail, 5, 60000)) { // 5 batch requests per minute
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { questions, answers } = req.body;

  if (!Array.isArray(questions) || !Array.isArray(answers) || questions.length !== answers.length) {
    return res.status(400).json({ error: 'Invalid input: questions and answers arrays must match' });
  }

  // Limit batch size
  if (questions.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 questions per batch' });
  }

  // Build prompt with clear formatting instructions
  const qaPairs = questions.map((q, i) => `Q${i+1}: ${q}\nA${i+1}: ${answers[i]}`).join('\n\n');

  const prompt = `You are an AI tutor. Mark the following student answers. For each question, provide a score out of 10, three strengths, and three areas to improve.
Return the results as a JSON array of objects, each with keys: score (number), strengths (array of strings), improvements (array of strings).

Here are the questions and answers:
${qaPairs}

Output only the JSON array, no other text.`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a strict tutor. Follow instructions exactly and output only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('DeepSeek API error:', data);
      throw new Error(data.error?.message || 'Batch marking failed');
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response structure from AI');
    }

    const aiContent = data.choices[0].message.content;

    let results;
    try {
      results = extractJSON(aiContent);
    } catch (e) {
      console.error('JSON extraction failed:', aiContent);
      throw new Error('AI response was not valid JSON');
    }

    if (!Array.isArray(results)) {
      throw new Error('AI response is not an array');
    }

    // Pad or truncate to match questions length
    if (results.length !== questions.length) {
      while (results.length < questions.length) {
        results.push({ score: 0, strengths: ['No feedback available'], improvements: ['Try again'] });
      }
      if (results.length > questions.length) results = results.slice(0, questions.length);
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Error in mark-batch:', error);
    res.status(500).json({ error: 'Batch marking failed', details: error.message });
  }
}
