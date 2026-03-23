export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: "Generate math questions. Return ONLY valid JSON. No explanation."
          }
        ]
      })
    });

    // ✅ Check content type BEFORE parsing
    const contentType = response.headers.get("content-type");

    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Non-JSON response from AI:", text);

      return res.status(500).json({
        error: "AI service returned invalid response"
      });
    }

    // ✅ Safe JSON parsing
    let data;
    try {
      data = await response.json();
    } catch (err) {
      const text = await response.text();
      console.error("JSON parse failed:", text);

      return res.status(500).json({
        error: "Failed to parse AI response"
      });
    }

    // ✅ Extract safely
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: "No content from AI"
      });
    }

    // ✅ Try parsing AI JSON output
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("AI returned invalid JSON:", content);

      return res.status(500).json({
        error: "AI returned malformed JSON"
      });
    }

    return res.status(200).json({
      questions: parsed
    });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
