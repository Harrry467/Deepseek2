// api/explain.js
import { extractJSON } from '../utils/ai.js';
import { supabase } from '../utils/supabase.js';

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
    const aiResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a clear, friendly tutor who explains concepts concisely.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      console.error('DeepSeek error:', data);
      return res.status(500).json({ error: 'DeepSeek API failed', details: data.error?.message });
    }

    const explanation = data.choices?.[0]?.message?.content;
    if (!explanation) {
      return res.status(500).json({ error: 'No response from DeepSeek' });
    }

    return res.status(200).json({ explanation: explanation.trim() });

  } catch (err) {
    console.error('explain.js error:', err);
    return res.status(500).json({ error: 'Something went wrong', details: err.message });
  }
}
