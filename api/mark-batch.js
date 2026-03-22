// api/mark-batch.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { questions, answers } = req.body;

    // Build a prompt that asks DeepSeek to mark all answers at once
    const prompt = `You are an AI tutor. Mark the following student answers. For each question, provide a score out of 10, three strengths, and three areas to improve.
Return the results as a JSON array of objects, each with keys: score (number), strengths (array of strings), improvements (array of strings).
Here are the questions and answers:

${questions.map((q, i) => `Q${i+1}: ${q}\nA${i+1}: ${answers[i]}`).join('\n\n')}

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
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
            })
        });

        const data = await response.json();
        const aiContent = data.choices[0].message.content;
        let results;
        try {
            results = JSON.parse(aiContent);
        } catch (e) {
            // Try to extract JSON array from text
            const match = aiContent.match(/\[[\s\S]*\]/);
            if (match) {
                results = JSON.parse(match[0]);
            } else {
                throw new Error('Could not parse AI response as JSON');
            }
        }
        if (!Array.isArray(results) || results.length !== questions.length) {
            throw new Error('AI response did not match question count');
        }
        res.status(200).json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Marking failed', details: error.message });
    }
}
