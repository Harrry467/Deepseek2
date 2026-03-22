// api/generate-questions.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { subject, topic, level, difficulty, numQuestions } = req.body;

    const prompt = `Generate exactly ${numQuestions} practice questions for ${subject} on the topic of ${topic} at ${level} level with difficulty ${difficulty}/10.
Return the questions as a JSON array of strings. For example: ["Question 1", "Question 2", ...]. Only output the JSON array, no other text.`;

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        const data = await response.json();
        const aiContent = data.choices[0].message.content;

        // Attempt to extract JSON from the response
        let questions;
        try {
            // Try to parse the whole content as JSON
            questions = JSON.parse(aiContent);
        } catch (e) {
            // Fallback: find the first '[' and last ']' and parse that substring
            const start = aiContent.indexOf('[');
            const end = aiContent.lastIndexOf(']') + 1;
            if (start !== -1 && end > start) {
                const jsonStr = aiContent.substring(start, end);
                questions = JSON.parse(jsonStr);
            } else {
                throw new Error('Could not find JSON array in AI response');
            }
        }

        if (!Array.isArray(questions)) {
            throw new Error('AI response is not an array');
        }

        // Ensure we have exactly the requested number (or less if AI limited)
        if (questions.length > numQuestions) {
            questions = questions.slice(0, numQuestions);
        }

        res.status(200).json({ questions });
    } catch (error) {
        console.error('Error in generate-questions:', error);
        res.status(500).json({ error: 'Failed to generate questions', details: error.message });
    }
}
