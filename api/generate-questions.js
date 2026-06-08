// api/generate-questions.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

function cleanJSON(text) {
  try {
    const cleaned = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('JSON parse failed:', err);
    return null;
  }
}

async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subject, topic, level, difficulty, numQuestions } = req.body;

    if (!subject || !topic) {
      return res.status(400).json({ error: 'Subject and topic are required' });
    }

    const difficultyNum = Math.min(10, Math.max(1, Number(difficulty || 5)));
    const questionCount = Math.min(20, Math.max(1, Number(numQuestions || 5)));

    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({ user_id: user.id, subject, topic, level, difficulty: difficultyNum })
      .select()
      .single();

    if (sessionError) {
      console.error('Session insert error:', sessionError);
      return res.status(500).json({ error: 'Could not create session' });
    }

    // Build prompt
    const prompt = `Generate EXACTLY ${questionCount} questions.

Subject: ${subject}
Topic: ${topic}
Level: ${level}
Difficulty: ${difficultyNum}/10

RULES:
- Return ONLY valid JSON
- No markdown
- No explanations
- Format MUST be:

{
  "questions": [
    "question 1",
    "question 2"
  ]
}`;

    // Call DeepSeek with timeout + retry
    let aiResponse;
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        aiResponse = await fetchWithTimeout(
          'https://api.deepseek.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: 'You only return valid JSON. Never include markdown.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.7,
              max_tokens: 1500
            })
          },
          15000
        );
        if (aiResponse.ok) break;
        lastError = new Error(`DeepSeek responded with status ${aiResponse.status}`);
      } catch (err) {
        lastError = err;
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 1000));
        }
      }
    }

    if (!aiResponse?.ok) {
      const errText = aiResponse ? await aiResponse.text() : lastError?.message;
      console.error('DeepSeek error after retries:', errText);
      return res.status(500).json({ error: 'DeepSeek API failed', details: errText });
    }

    const aiData = await aiResponse.json();
    const aiText = aiData?.choices?.[0]?.message?.content;

    if (!aiText) {
      console.error('No content in DeepSeek response:', aiData);
      return res.status(500).json({ error: 'No AI response received' });
    }

    const parsed = cleanJSON(aiText);
    if (!Array.isArray(parsed?.questions)) {
      console.error('Unexpected AI format:', aiText);
      return res.status(500).json({ error: 'AI returned invalid format' });
    }

    const questions = parsed.questions.slice(0, questionCount);

    // Save questions
    const questionRows = questions.map(q => ({
      session_id: session.id,
      question_text: q,
      is_custom: false
    }));

    const { data: insertedQuestions, error: insertError } = await supabase
      .from('questions')
      .insert(questionRows)
      .select();

    if (insertError) {
      console.error('Question insert error:', insertError);
      return res.status(500).json({ error: 'Failed to save questions' });
    }

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      questionIds: insertedQuestions.map(q => q.id),
      questions
    });

  } catch (error) {
    console.error('Unhandled error in generate-questions:', error);
    return res.status(500).json({ error: 'Something went wrong', details: error.message });
  }
}
