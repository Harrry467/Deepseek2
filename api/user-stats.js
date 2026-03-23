// api/user-stats.js
import { supabase } from '../utils/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get authenticated user
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Fetch user profile (XP)
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('xp')
    .eq('id', user.id)
    .single();

  // Fetch all answers with related question data
  const { data: answers, error: answersError } = await supabase
    .from('answers')
    .select(`
      id,
      answer_text,
      score,
      strengths,
      improvements,
      created_at,
      question:question_id (
        id,
        question_text,
        subject,
        topic,
        level,
        is_custom
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (answersError) {
    console.error('Error fetching answers:', answersError);
    return res.status(500).json({ error: 'Failed to fetch answer history' });
  }

  // Calculate XP for different periods
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const filterByDate = (answers, startDate) => answers.filter(a => new Date(a.created_at) >= startDate);
  const sumXp = (arr) => arr.reduce((sum, a) => sum + (a.score * 10), 0);

  const xpToday = sumXp(filterByDate(answers, startOfDay));
  const xpWeek = sumXp(filterByDate(answers, startOfWeek));
  const xpMonth = sumXp(filterByDate(answers, startOfMonth));
  const xpYear = sumXp(filterByDate(answers, startOfYear));

  // Format answers for frontend
  const formattedAnswers = answers.map(a => ({
    id: a.id,
    questionText: a.question?.question_text || 'Unknown question',
    subject: a.question?.subject || '',
    topic: a.question?.topic || '',
    answerText: a.answer_text,
    score: a.score,
    createdAt: a.created_at,
  }));

  res.status(200).json({
    totalXp: profile?.xp || 0,
    xpToday,
    xpWeek,
    xpMonth,
    xpYear,
    answers: formattedAnswers,
  });
}
