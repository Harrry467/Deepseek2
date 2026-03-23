// utils/ai.js
export function extractJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    if (start !== -1 && end > start) {
      return JSON.parse(text.substring(start, end));
    }
    // Try array fallback
    const arrStart = text.indexOf('[');
    const arrEnd = text.lastIndexOf(']') + 1;
    if (arrStart !== -1 && arrEnd > arrStart) {
      return JSON.parse(text.substring(arrStart, arrEnd));
    }
    throw new Error('Could not extract JSON from AI response');
  }
}
