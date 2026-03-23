// api/mark-batch.js
import { extractJSON } from '../utils/ai.js';
import { supabase } from '../utils/supabase.js';

const rateLimits = new Map();
function checkRateLimit(ip, limit = 5, windowMs = 60000) {
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
  if (!checkRateLimit(clientIp, 5, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { questions, answers, questionIds, sessionId } = req.body;
  if (!Array.isArray(questions) || !Array.isArray(answers) || questions.length !== answers.length) {
    return res.status(400).json({ error: 'Invalid input: questions and answers arrays must match' });
  }
  if (questions.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 questions per batch' });
  }

  const qaPairs = questions.map((q, i) => `Q${i+1}: ${q}\nA${i+1}: ${answers[i]}`).join('\n\n');
  const prompt = `You are an AI tutor. Mark the following student answers. For each question, provide a score out of 10, three strengths, and three areas to improve.
Return the results as a JSON array of objects, each with keys: score (number), strengths (array of strings), improvements (array of strings).

Here are the questions and answers:
${qaPairs}

Output only the JSON array, no other text.`;

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
          { role: 'system', content: 'You are a strict tutor. Follow instructions exactly and output only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Batch marking failed');
    if (!data.choices?.[0]?.message) throw new Error('Invalid AI response');

    let results = extractJSON(data.choices[0].message.content);
    if (!Array.isArray(results)) throw new Error('AI response is not an array');

    // Pad or truncate to match questions length
    while (results.length < questions.length) {
      results.push({ score: 0, strengths: ['No feedback available'], improvements: ['Try again'] });
    }
    if (results.length > questions.length) results = results.slice(0, questions.length);

    // Save all answers to DB if user is logged in
    const user = await getUserFromRequest(req);
    if (user && Array.isArray(questionIds) && questionIds.length === questions.length) {
      const answerRows = results.map((result, i) => ({
        question_id: questionIds[i],
        user_id: user.id,
        answer_text: answers[i],
        score: result.score,
        strengths: result.strengths,
        improvements: result.improvements
      }));
      await supabase.from('answers').insert(answerRows);

      // ========== NEW: Update user XP ==========
      // Calculate total XP earned from this batch (score * 10 per answer)
      const xpEarned = results.reduce((sum, result) => sum + (result.score * 10), 0);

      // Fetch current user profile (XP)
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('xp')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        // If some other error, log it but don't fail the request
        console.error('Error fetching user profile:', profileError);
      }

      if (!profile) {
        // No profile exists – create one (shouldn't happen with trigger, but just in case)
        await supabase.from('user_profiles').insert({ id: user.id, xp: xpEarned });
      } else {
        const newXp = (profile.xp || 0) + xpEarned;
        await supabase.from('user_profiles').update({ xp: newXp }).eq('id', user.id);
      }
      // ========================================
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Error in mark-batch:', error);
    res.status(500).json({ error: 'Batch marking failed', details: error.message });
  }
}
