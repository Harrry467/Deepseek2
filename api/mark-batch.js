// api/mark-batch.js
const { extractJSON } = require('../utils/ai');

const rateLimits = new Map();
function checkRateLimit(ip, limit = 5, windowMs = 60000) {
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
  if (!checkRateLimit(clientIp, 5, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { questions, answers } = req.body;
  if (!Array.isArray(questions) || !Array.isArray(answers) || questions.length !== answers.length) {
    return res.status(400).json({ error: 'Invalid input: questions and answers arrays must match' });
  }
  if (questions.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 questions per batch' });
  }

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
    if (!response.ok) throw new Error(data.error?.message || 'Batch marking failed');
    if (!data.choices?.[0]?.message) throw new Error('Invalid AI response');

    const aiContent = data.choices[0].message.content;
    let results;
    try {
      results = extractJSON(aiContent);
    } catch (e) {
      console.error('JSON extraction failed:', aiContent);
      throw new Error('AI response was not valid JSON');
    }
    if (!Array.isArray(results)) throw new Error('AI response is not an array');

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
