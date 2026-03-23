import { extractJSON } from '../utils/ai.js';
import { supabase } from '../utils/supabase.js';

const rateLimits = new Map();

function checkRateLimit(ip, limit = 10, windowMs = 60000) {
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

  // 1. Rate Limiting
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!checkRateLimit(clientIp, 10, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  // 2. Validation
  const { subject, topic, level, difficulty, numQuestions } = req.body;
  if (!subject || !topic) {
    return res.status(400).json({ error: 'Missing required fields: subject and topic' });
  }

  const num = Math.min(Math.max(parseInt(numQuestions) || 5, 1), 20);
  const diff = Math.min(Math.max(parseInt(difficulty) || 5, 1), 10);

  const prompt = `Generate exactly ${num} practice questions for ${subject} on the topic of ${topic} at ${level} level with difficulty ${diff}/10.
  Return ONLY a JSON array of strings. Example: ["Question 1", "Question 2"]. No markdown, no intro text.`;

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
          { 
            role: 'system', 
            content: 'You are a strict JSON generator. You never include conversational text. You only output valid JSON arrays.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' } // Some providers support this to force JSON
      })
    });

    // 3. Robust Response Handling (Fixes the "Unexpected Token A" error)
    const contentType = response.headers.get("content-type");
    
    if (!response.ok) {
      // If the server returns 502/504 or an API error, read as text first to avoid crashing
      const errorText = await response.text();
      console.error(`API Error (${response.status}):`, errorText);
      throw new Error(`Upstream API error: ${response.statusText}`);
    }

    if (!contentType || !contentType.includes("application/json")) {
      const nonJsonBody = await response.text();
      console.error("Received non-JSON response:", nonJsonBody);
      throw new Error("The AI server returned an invalid format (HTML/Text) instead of JSON.");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI response was empty');
    }

    // 4. Parsing Logic
    let questions = extractJSON(content);
    
    if (!Array.isArray(questions)) {
      // Fallback: If extractJSON failed because it's already a string, try to parse it
      try {
        questions = JSON.parse(content);
      } catch (e) {
        throw new Error('Failed to parse AI output into a list of questions');
      }
    }

    if (questions.length > num) questions = questions.slice(0, num);

    // 5. Database Interaction
    const user = await getUserFromRequest(req);
    let sessionId = null;

    if (user) {
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({ 
          user_id: user.id, 
          subject, 
          topic, 
          level, 
          difficulty: diff 
        })
        .select('id')
        .single();

      if (!sessionError && session) {
        sessionId = session.id;
        const questionRows = questions.map(q => ({
          session_id: sessionId,
          question_text: q,
          is_custom: false
        }));
        await supabase.from('questions').insert(questionRows);
      }
    }

    // 6. Success
    return res.status(200).json({ questions, sessionId });

  } catch (error) {
    console.error('Error in generate-questions:', error);
    return res.status(500).json({ 
      error: 'Failed to generate questions', 
      details: error.message 
    });
  }
}
