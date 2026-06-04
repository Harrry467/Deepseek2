// api/mark-batch.js
import { extractJSON } from '../utils/ai.js';
import { supabase } from '../utils/supabase.js';

// Rate limiting removed for brevity – consider using Upstash Redis instead

async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { questions, answers, questionIds, sessionId } = req.body;
  if (!Array.isArray(questions) || !Array.isArray(answers) || questions.length !== answers.length) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (questions.length === 0) return res.status(400).json({ error: 'No questions' });

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Ensure all questionIds belong to the user (security)
  if (questionIds && questionIds.length === questions.length) {
    const { data: valid, error } = await supabase
      .from('questions')
      .select('id')
      .in('id', questionIds)
      .eq('session_id', sessionId);
    if (error || !valid || valid.length !== questionIds.length) {
      return res.status(403).json({ error: 'Invalid question IDs' });
    }
  } else {
    return res.status(400).json({ error: 'Missing question IDs' });
  }

  // Build prompt for AI marking
  const qaPairs = questions.map((q, i) => `Q${i+1}: ${q}\nA${i+1}: ${answers[i]}`).join('\n\n');
  const prompt = `Mark these student answers. For each, give score (0-10), three strengths, three improvements.
Return JSON array of objects: [{"score":7,"strengths":["a","b","c"],"improvements":["x","y","z"]}]
${qaPairs}`;

  let results;
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
          { role: 'system', content: 'Output only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    const data = await response.json();
    const content = data.choices[0].message.content;
    results = extractJSON(content);
    if (!Array.isArray(results)) throw new Error('Not an array');
    while (results.length < questions.length) results.push({ score: 0, strengths: [], improvements: [] });
    if (results.length > questions.length) results = results.slice(0, questions.length);
  } catch (err) {
    console.error('Marking AI error:', err);
    return res.status(500).json({ error: 'Marking failed' });
  }

  // Insert answers
  const answerRows = results.map((result, i) => ({
    question_id: questionIds[i],
    user_id: user.id,
    answer_text: answers[i],
    score: result.score,
    strengths: result.strengths || [],
    improvements: result.improvements || []
  }));
  const { error: insertError } = await supabase.from('answers').insert(answerRows);
  if (insertError) {
    console.error('Answer insert error:', insertError);
    // Non-fatal – we still return results
  }

  // Update XP (score * 10 per answer)
  const xpEarned = results.reduce((sum, r) => sum + (r.score * 10), 0);
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('xp')
    .eq('id', user.id)
    .single();
  const newXp = (profile?.xp || 0) + xpEarned;
  await supabase.from('user_profiles').upsert({ id: user.id, xp: newXp });

  res.status(200).json(results);
}
