// api/generate-questions.js
import { supabase } from '../utils/supabase.js';

function extractJSON(text) {
  // ... same as before ...
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subject, topic, level, difficulty, numQuestions } = req.body;

  // Input validation
  if (!subject || !topic) {
    return res.status(400).json({ error: 'Missing subject or topic' });
  }
  const num = parseInt(numQuestions);
  if (isNaN(num) || num < 1 || num > 20) {
    return res.status(400).json({ error: 'numQuestions 1-20' });
  }
  const diff = parseInt(difficulty);
  if (isNaN(diff) || diff < 1 || diff > 10) {
    return res.status(400).json({ error: 'difficulty 1-10' });
  }

  // Get authenticated user
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // 1. Create session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({ user_id: user.id, subject, topic, level, difficulty })
    .select()
    .single();
  if (sessionError) {
    console.error('Session insert error:', sessionError);
    return res.status(500).json({ error: 'Failed to create session' });
  }

  // 2. Generate questions via DeepSeek
  const prompt = `Generate exactly ${num} practice questions for ${subject} on ${topic} at ${level} level, difficulty ${diff}/10.
Return as JSON array of strings: ["Q1", "Q2", ...]. No extra text.`;

  let aiQuestions = [];
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You output only valid JSON arrays.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    const data = await response.json();
    const content = data.choices[0].message.content;
    aiQuestions = extractJSON(content);
    if (!Array.isArray(aiQuestions)) throw new Error('Not an array');
    aiQuestions = aiQuestions.slice(0, num);
  } catch (err) {
    console.error('AI generation failed:', err);
    return res.status(500).json({ error: 'Failed to generate questions', details: err.message });
  }

  // 3. Insert questions into DB
  const questionsToInsert = aiQuestions.map(text => ({
    session_id: session.id,
    question_text: text,
    is_custom: false
  }));
  const { data: insertedQuestions, error: insertError } = await supabase
    .from('questions')
    .insert(questionsToInsert)
    .select();
  if (insertError) {
    console.error('Question insert error:', insertError);
    return res.status(500).json({ error: 'Failed to save questions' });
  }

  // 4. Return to frontend
  res.status(200).json({
    questions: aiQuestions,
    sessionId: session.id,
    questionIds: insertedQuestions.map(q => q.id)
  });
}
