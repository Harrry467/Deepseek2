// api/generate-questions.js
const { extractJSON } = require('../utils/ai'); // we'll keep the utility

// Simple in‑memory rate limiter (optional – remove if you don't want it)
const rateLimits = new Map();

function checkRateLimit(ip, limit = 10, windowMs = 60000) {
  const now = Date.now();
  const record = rateLimits.get(ip);
  if (!record || now > record.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= limit) return false;
  record.count++;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: rate limit by IP
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!checkRateLimit(clientIp, 10, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { subject, topic, level, difficulty, numQuestions } = req.body;

  // Input validation
  if (!subject || !topic) {
    return res.status(400).json({ error: 'Missing required fields: subject and topic' });
  }
  const num = parseInt(numQuestions);
  if (isNaN(num) || num < 1 || num > 20) {
    return res.status(400).json({ error: 'numQuestions must be between 1 and 20' });
  }
  const diff = parseInt(difficulty);
  if (isNaN(diff) || diff < 1 || diff > 10) {
    return res.status(400).json({ error: 'difficulty must be between 1 and 10' });
  }

  const prompt = `Generate exactly ${num} practice questions for ${subject} on the topic of ${topic} at ${level} level with difficulty ${diff}/10.
Return the questions as a JSON array of strings. For example: ["Question 1", "Question 2", ...]. Only output the JSON array, no other text.`;

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
          { role: 'system', content: 'You are a helpful assistant that generates questions. Follow instructions strictly.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Failed to generate questions');
    if (!data.choices?.[0]?.message) throw new Error('Invalid AI response');

    const aiContent = data.choices[0].message.content;
    let questions;
    try {
      questions = extractJSON(aiContent);
    } catch (e) {
      console.error('JSON extraction failed:', aiContent);
      throw new Error('AI response was not valid JSON');
    }
    if (!Array.isArray(questions)) throw new Error('AI response is not an array');

    if (questions.length > num) questions = questions.slice(0, num);
    res.status(200).json({ questions });
  } catch (error) {
    console.error('Error in generate-questions:', error);
    res.status(500).json({ error: 'Failed to generate questions', details: error.message });
  }
}
