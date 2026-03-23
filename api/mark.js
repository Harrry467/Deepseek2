// api/mark.js
import { extractJSON } from '../utils/ai.js';
import { supabase } from '../utils/supabase.js';

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

async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!checkRateLimit(clientIp, 15, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { question, userAnswer, modelAnswerHint, questionId } = req.body;
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

    const result = extractJSON(data.choices[0].message.content);
    if (typeof result.score !== 'number' || !Array.isArray(result.strengths) || !Array.isArray(result.improvements)) {
      throw new Error('AI response missing required fields');
    }

    // Save answer to DB if user is logged in and questionId was provided
    const user = await getUserFromRequest(req);
    if (user && questionId) {
      await supabase.from('answers').insert({
        question_id: questionId,
        user_id: user.id,
        answer_text: userAnswer,
        score: result.score,
        strengths: result.strengths,
        improvements: result.improvements
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in mark:', error);
    res.status(500).json({ error: 'AI marking failed', details: error.message });
  }
}
