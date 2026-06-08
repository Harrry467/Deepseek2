// api/explain-questions.js
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
    const aiResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You only return valid JSON. Never include markdown or extra text.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1200
      })
    });

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      console.error('DeepSeek error:', data);
      return res.status(500).json({ error: 'DeepSeek API failed', details: data.error?.message });
    }

    const aiText = data.choices?.[0]?.message?.content;
    if (!aiText) {
      return res.status(500).json({ error: 'No response from DeepSeek' });
    }

    // ---------- PARSE ----------
    const parsed = extractJSON(aiText);

    if (!Array.isArray(parsed?.questions) || parsed.questions.length < 3) {
      console.error('Unexpected AI format:', aiText);
      return res.status(500).json({ error: 'AI returned unexpected format' });
    }

    // Normalise fields so the frontend never gets undefined
    const questions = parsed.questions.slice(0, 3).map((q, i) => ({
      question:    q.question    || `Question ${i + 1}`,
      bigHint:     q.bigHint     || '',
      mediumHint:  q.mediumHint  || '',
      modelAnswer: q.modelAnswer || ''
    }));

    return res.status(200).json({ questions });

  } catch (err) {
    console.error('explain-questions.js error:', err);
    return res.status(500).json({ error: 'Could not generate questions', details: err.message });
  }
}
