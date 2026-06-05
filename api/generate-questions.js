// api/generate-questions.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

function cleanJSON(text) {
  try {
    // Remove markdown code blocks if DeepSeek adds them
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const {
      subject,
      topic,
      level,
      difficulty,
      numQuestions
    } = req.body;

    // ---------- VALIDATION ----------
    if (!subject || !topic) {
      return res.status(400).json({
        error: 'Subject and topic are required'
      });
    }

    const difficultyNum = Number(difficulty || 5);
    const questionCount = Number(numQuestions || 5);

    // ---------- AUTH ----------
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Not logged in'
      });
    }

    const token = authHeader.split(' ')[1];

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error(userError);

      return res.status(401).json({
        error: 'Invalid session'
      });
    }

    // ---------- CREATE SESSION ----------
    const { data: session, error: sessionError } =
      await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          subject,
          topic,
          level,
          difficulty: difficultyNum
        })
        .select()
        .single();

    if (sessionError) {
      console.error(sessionError);

      return res.status(500).json({
        error: 'Could not create session'
      });
    }

    // ---------- AI PROMPT ----------
    const prompt = `
Generate EXACTLY ${questionCount} questions.

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
}
`;

    // ---------- DEEPSEEK REQUEST ----------
    const aiResponse = await fetch(
      'https://api.deepseek.com/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content:
                'You only return valid JSON. Never include markdown.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1500
        })
      }
    );

    // ---------- API ERROR ----------
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();

      console.error('DeepSeek Error:', errText);

      return res.status(500).json({
        error: 'DeepSeek API failed',
        details: errText
      });
    }

    const aiData = await aiResponse.json();

    const aiText =
      aiData?.choices?.[0]?.message?.content;

    if (!aiText) {
      console.error(aiData);

      return res.status(500).json({
        error: 'No AI response received'
      });
    }

    // ---------- PARSE QUESTIONS ----------
    const parsed = cleanJSON(aiText);

    if (!parsed?.questions) {
      console.error(aiText);

      return res.status(500).json({
        error: 'AI returned invalid format'
      });
    }

    const questions = parsed.questions.slice(
      0,
      questionCount
    );

    // ---------- SAVE QUESTIONS ----------
    const questionRows = questions.map((q) => ({
      session_id: session.id,
      question_text: q,
      is_custom: false
    }));

    const {
      data: insertedQuestions,
      error: insertError
    } = await supabase
      .from('questions')
      .insert(questionRows)
      .select();

    if (insertError) {
      console.error(insertError);

      return res.status(500).json({
        error: 'Failed to save questions'
      });
    }

    // ---------- SUCCESS ----------
    return res.status(200).json({
      success: true,
      sessionId: session.id,
      questionIds: insertedQuestions.map(
        (q) => q.id
      ),
      questions
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Something went wrong',
      details: error.message
    });
  }
}
