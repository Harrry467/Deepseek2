async function generateQuestions(payload) {
  const res = await fetch('/api/generate-questions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let data;

  // ✅ Protect against invalid JSON (THIS FIXES YOUR ERROR)
  try {
    data = await res.json();
  } catch (err) {
    throw new Error("Server returned invalid response. Try again.");
  }

  // ✅ Handle backend errors properly
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data.questions;
}
