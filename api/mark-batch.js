// api/mark-batch.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { questions, answers } = req.body;

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
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        const data = await response.json();
        const aiContent = data.choices[0].message.content;

        // Extract JSON array
        let results;
        try {
            results = JSON.parse(aiContent);
        } catch (e) {
            const start = aiContent.indexOf('[');
            const end = aiContent.lastIndexOf(']') + 1;
            if (start !== -1 && end > start) {
                const jsonStr = aiContent.substring(start, end);
                results = JSON.parse(jsonStr);
            } else {
                throw new Error('Could not extract JSON from AI response');
            }
        }

        if (!Array.isArray(results)) {
            throw new Error('AI response is not an array');
        }

        // Ensure results match the number of questions
        if (results.length !== questions.length) {
            // If fewer, pad with default feedback
            while (results.length < questions.length) {
                results.push({
                    score: 0,
                    strengths: ['No feedback available'],
                    improvements: ['Try again']
                });
            }
            // If too many, slice
            results = results.slice(0, questions.length);
        }

        // Validate each result has the required structure
        results = results.map(r => ({
            score: typeof r.score === 'number' ? r.score : 5,
            strengths: Array.isArray(r.strengths) ? r.strengths.slice(0,3) : ['Answer submitted'],
            improvements: Array.isArray(r.improvements) ? r.improvements.slice(0,3) : ['Review your answer']
        }));

        res.status(200).json(results);
    } catch (error) {
        console.error('Error in mark-batch:', error);
        res.status(500).json({ error: 'Marking failed', details: error.message });
    }
}
