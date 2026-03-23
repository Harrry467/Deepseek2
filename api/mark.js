// api/mark.js
const { extractJSON } = require('../utils/ai');

const rateLimits = new Map();
function checkRateLimit(ip, limit = 15, windowMs = 60000) {
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

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!checkRateLimit(clientIp, 15, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { question, userAnswer, modelAnswerHint } = req.body;
  if (!question || !userAnswer) {
    return res.status(400).json({ error: 'Missing required fields: question and userAnswer' });
  }

  const prompt = `You are an AI tutor. Mark the student's answer to the following question.
Question: ${question}
${modelAnswerHint ? `Model answer: ${modelAnswerHint}` : 'Model answer: No model answer provided.'}
Student answer: ${userAnswer}

Provide a score out of 10, three strengths, and three areas to improve.
Return the result in JSON format exactly like this:
{
  "score": 7,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["improvement 1", "improvement 2", "improvement 3"]
}`;

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
          { role: 'system', content: 'You are a strict tutor. Follow instructions exactly.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'AI marking failed');
    if (!data.choices?.[0]?.message) throw new Error('Invalid AI response');

    const aiContent = data.choices[0].message.content;
    let result;
    try {
      result = extractJSON(aiContent);
    } catch (e) {
      console.error('JSON extraction failed:', aiContent);
      throw new Error('AI response was not valid JSON');
    }

    if (typeof result.score !== 'number' || !Array.isArray(result.strengths) || !Array.isArray(result.improvements)) {
      throw new Error('AI response missing required fields');
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in mark:', error);
    res.status(500).json({ error: 'AI marking failed', details: error.message });
  }
}
