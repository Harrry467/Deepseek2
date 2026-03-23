import { extractJSON } from '../utils/ai.js';
import { supabase } from '../utils/supabase.js';

const rateLimits = new Map();

/**
 * Basic Memory-based Rate Limiting
 */
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

/**
 * Get User from Supabase Auth Header
 */
async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (err) {
    return null;
  }
}

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Check Rate Limit
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!checkRateLimit(clientIp, 10, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  // 3. Validate Input
  const { subject, topic, level, difficulty, numQuestions } = req.body;

  if (!subject || !topic) {
    return res.status(400).json({ error: 'Missing required fields: subject and topic' });
  }

  const num = Math.min(Math.max(parseInt(numQuestions) || 5, 1), 20);
  const diff = Math.min(Math.max(parseInt(difficulty) || 5, 1), 10);

  const prompt = `Generate exactly ${num} practice questions for ${subject} on the topic of ${topic} at ${level} level with difficulty ${diff}/10. 
  Return the questions as a JSON array of strings ONLY. Example: ["Question 1", "Question 2"]. Do not include any other text or explanation.`;

  try {
    // 4. Call AI API
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
            content: 'You are a professional examiner. You strictly output valid JSON arrays of strings without any conversational filler.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    // --- CRITICAL FIX: The "Unexpected Token A" Guard ---
    const contentType = response.headers.get("content-type");
    
    // Check if the response is NOT JSON (e.g., an HTML error page starting with "A server error...")
    if (!contentType || !contentType.includes("application/json")) {
      const errorText = await response.text();
      console.error("AI Provider returned non-JSON response:", errorText);
      throw new Error("The AI service is currently overloaded or unavailable. Please try again in a few seconds.");
    }

    // Now it is safe to parse as JSON
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `AI API Error: ${response.status}`);
    }

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('AI returned an empty response.');
    }

    // 5. Parse and Extract Questions
    const rawContent = data.choices[0].message.content;
    let questions = extractJSON(rawContent);

    // Final safety check if extractJSON fails
    if (!Array.isArray(questions)) {
      try {
        questions = JSON.parse(rawContent);
      } catch (e) {
        throw new Error('Could not parse questions from AI response.');
      }
    }

    if (questions.length > num) questions = questions.slice(0, num);

    // 6. Save to Database if user is logged in
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

    // 7. Success Response
    return res.status(200).json({ questions, sessionId });

  } catch (error) {
    console.error('Error in generate-questions handler:', error.message);
    
    // Return a valid JSON error object to the frontend
    return res.status(500).json({ 
      error: 'Failed to generate questions', 
      details: error.message 
    });
  }
}
