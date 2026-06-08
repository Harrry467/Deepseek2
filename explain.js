// api/explain.js
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
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens
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

  const { topic } = req.body;

  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    return res.status(400).json({ error: 'topic is required' });
  }

  // ---------- AUTH ----------
  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  // ---------- PROMPT ----------
  const prompt = `You are a friendly, expert tutor. A student has asked you to explain the following topic or question:

"${topic.trim()}"

Give a clear, concise explanation in plain English suitable for a secondary school or sixth-form student.
Use examples, analogies, or step-by-step reasoning where helpful.
Keep it under 250 words. Do NOT generate any practice questions — just explain the concept clearly.`;

  // ---------- DEEPSEEK REQUEST ----------
  try {
    const content = await callDeepSeek([
      { role: 'system', content: 'Follow instructions exactly.' },
      { role: 'user', content: prompt }
    ], 800);

    return res.status(200).json({ explanation: content.trim() });

  } catch (err) {
    console.error('explain.js error:', err);
    return res.status(500).json({ error: 'Something went wrong', details: err.message });
  }
}
