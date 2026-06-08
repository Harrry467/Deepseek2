import { extractJSON } from '../utils/ai.js';
// api/explain-questions.js
import { supabase } from '../utils/supabase.js';

async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function callDeepSeek(messages, max_tokens = 1000) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens,
      response_format: { type: 'json_object' }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `DeepSeek error ${response.status}`);
  }

  const content = data?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('Empty response from DeepSeek');
  }

  return content;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic, explanation } = req.body;

  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    return res.status(400).json({ error: 'topic is required' });
  }

  // ---------- AUTH ----------
  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  // ---------- PROMPT ----------
  const prompt = `You are a tutor. Based on the following topic and explanation, generate exactly 3 practice questions to test a student's understanding.

Topic: "${topic.trim()}"
Explanation: "${(explanation || '').trim()}"

Return ONLY valid JSON — no markdown, no explanation, no preamble. Format exactly:
{
  "questions": [
    {
      "question": "Full question text here",
      "bigHint": "A detailed hint that almost gives the answer away but still requires the student to apply it",
      "mediumHint": "A more subtle hint — a nudge in the right direction",
      "modelAnswer": "A concise correct answer for marking purposes"
    },
    {
      "question": "...",
      "bigHint": "...",
      "mediumHint": "...",
      "modelAnswer": "..."
    },
    {
      "question": "...",
      "bigHint": "...",
      "mediumHint": "...",
      "modelAnswer": "..."
    }
  ]
}`;

  // ---------- DEEPSEEK REQUEST ----------
  try {
    const content = await callDeepSeek([
      { role: 'system', content: 'Follow instructions exactly.' },
      { role: 'user', content: prompt }
    ], 1200);

    const parsed = extractJSON(content);

    if (!Array.isArray(parsed?.questions) || parsed.questions.length < 3) {
      throw new Error('AI returned invalid question format');
    }

    const questions = parsed.questions.slice(0, 3).map((q, i) => ({
      question: q.question || `Question ${i + 1}`,
      bigHint: q.bigHint || '',
      mediumHint: q.mediumHint || '',
      modelAnswer: q.modelAnswer || ''
    }));

    return res.status(200).json({ questions });

  } catch (err) {
    console.error('explain-questions.js error:', err);
    return res.status(500).json({ error: 'Could not generate questions', details: err.message });
  }
}
