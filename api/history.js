// api/history.js
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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    // Fetch sessions with their questions and answers
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        subject,
        topic,
        level,
        difficulty,
        created_at,
        questions (
          id,
          question_text,
          is_custom,
          answers (
            score,
            strengths,
            improvements,
            answer_text,
            created_at
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Calculate average score per session
    const sessionsWithStats = sessions.map(session => {
      const allAnswers = session.questions.flatMap(q => q.answers);
      const scores = allAnswers.map(a => a.score).filter(s => typeof s === 'number');
      const avgScore = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;
      return { ...session, avgScore, answeredCount: scores.length, totalQuestions: session.questions.length };
    });

    res.status(200).json(sessionsWithStats);
  } catch (error) {
    console.error('Error in history:', error);
    res.status(500).json({ error: 'Failed to fetch history', details: error.message });
  }
}
