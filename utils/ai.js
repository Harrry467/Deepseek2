// utils/ai.js
function extractJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    if (start !== -1 && end > start) {
      return JSON.parse(text.substring(start, end));
    }
    throw new Error('Could not extract JSON from AI response');
  }
}

module.exports = { extractJSON };
