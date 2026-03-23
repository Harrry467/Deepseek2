// utils/ai.js

// Extract JSON from an LLM response that may contain extra text
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

// Simple in-memory rate limiter
const rateLimits = new Map(); // key -> { count, resetTime }

function checkRateLimit(key, limit = 5, windowMs = 60000) {
  const now = Date.now();
  const record = rateLimits.get(key);
  if (!record || now > record.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count++;
  return true;
}

module.exports = { extractJSON, checkRateLimit };
