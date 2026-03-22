// api/generate-questions.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { subject, topic, level, difficulty, numQuestions } = req.body;

    const prompt = `Generate ${numQuestions} practice questions for ${subject} on the topic of ${topic} at ${level} level with difficulty ${difficulty}/10. 
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
                temperature: 0.7
            })
        });

        const data = await response.json();
        const aiContent = data.choices[0].message.content;
        // Parse the JSON array
        let questions;
        try {
            questions = JSON.parse(aiContent);
        } catch (e) {
            // If parsing fails, try to extract array with regex
            const match = aiContent.match(/\[.*\]/s);
            if (match) {
                questions = JSON.parse(match[0]);
            } else {
                throw new Error('AI response was not valid JSON');
            }
        }
        if (!Array.isArray(questions)) {
            throw new Error('AI did not return an array');
        }
        res.status(200).json({ questions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate questions', details: error.message });
    }
}
