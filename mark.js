// api/mark.js
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, userAnswer, modelAnswerHint } = req.body;

  // Build a prompt for the AI
  const prompt = `
You are an AI tutor. Mark the student's answer to the following question.
Question: ${question}
${modelAnswerHint ? `Model answer: ${modelAnswerHint}` : 'No model answer provided.'}
Student answer: ${userAnswer}

Provide a score out of 10, three strengths, and three areas to improve.
Return the result in JSON format exactly like this:
{
  "score": 7,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["improvement 1", "improvement 2", "improvement 3"]
}
`;

  try {
    // Call DeepSeek API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const aiContent = data.choices[0].message.content;

    // Parse the AI's JSON response (assumes it's valid JSON)
    const result = JSON.parse(aiContent);
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI marking failed' });
  }
}
