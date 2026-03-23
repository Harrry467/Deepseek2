// api/generate-questions.js

// Helper to extract JSON from AI responses (robust version)
function extractJSON(text) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch (e) {
    // If that fails, try to find the first '[' or '{' and last ']' or '}'
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']') + 1;
    if (start !== -1 && end > start) {
      return JSON.parse(text.substring(start, end));
    }
    // Maybe it's an object with a "questions" array?
    const objStart = text.indexOf('{');
    const objEnd = text.lastIndexOf('}') + 1;
    if (objStart !== -1 && objEnd > objStart) {
      const obj = JSON.parse(text.substring(objStart, objEnd));
      if (obj.questions && Array.isArray(obj.questions)) {
        return obj.questions;
      }
    }
    throw new Error('Could not extract JSON array from AI response');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subject, topic, level, difficulty, numQuestions } = req.body;

  // Input validation
  if (!subject || !topic) {
    return res.status(400).json({ error: 'Missing required fields: subject and topic' });
  }
  const num = parseInt(numQuestions);
  if (isNaN(num) || num < 1 || num > 20) {
    return res.status(400).json({ error: 'numQuestions must be between 1 and 20' });
  }
  const diff = parseInt(difficulty);
  if (isNaN(diff) || diff < 1 || diff > 10) {
    return res.status(400).json({ error: 'difficulty must be between 1 and 10' });
  }

  // Strict prompt – force JSON output
  const prompt = `Generate exactly ${num} practice questions for ${subject} on the topic of ${topic} at ${level} level with difficulty ${diff}/10.
Return the questions as a JSON array of strings. For example: ["Question 1", "Question 2", ...].
Rules:
- Output ONLY the JSON array.
- No text before or after.
- No markdown, no explanation.
- The JSON must be valid and parsable by JSON.parse.`;

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
            content: 'You are a JSON generator. You output only valid JSON. Never include any text, explanations, or markdown. Just the raw JSON array.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    // Check content type before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const errorText = await response.text();
      console.error('AI Provider returned non-JSON response:', errorText);
      throw new Error('The AI service is currently overloaded or unavailable. Please try again in a few seconds.');
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      const text = await response.text();
      console.error('Invalid JSON from AI:', text);
      throw new Error('AI returned invalid JSON.');
    }

    if (!response.ok) {
      console.error('DeepSeek API error:', data);
      throw new Error(data.error?.message || 'Failed to generate questions');
    }

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response structure from AI');
    }

    const aiContent = data.choices[0].message.content;
    console.log('AI raw output:', aiContent); // Optional: for debugging

    let questions;
    try {
      questions = extractJSON(aiContent);
    } catch (e) {
      console.error('JSON extraction failed:', aiContent);
      throw new Error('AI returned malformed JSON');
    }

    if (!Array.isArray(questions)) {
      throw new Error('AI response is not an array');
    }

    // Trim to requested number
    if (questions.length > num) {
      questions = questions.slice(0, num);
    }

    // Return the array directly, wrapped in an object
    res.status(200).json({ questions });
  } catch (error) {
    console.error('Error in generate-questions:', error);
    res.status(500).json({ error: 'Failed to generate questions', details: error.message });
  }
}
