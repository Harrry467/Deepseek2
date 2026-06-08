async function generateQuestions(payload) {
  const authHeader = await getAuthHeader();

  const res = await fetch('/api/generate-questions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader
    },
    body: JSON.stringify(payload)
  });

  let data;

  try {
    data = await res.json();
  } catch (err) {
    throw new Error("Server returned invalid response. Try again.");
  }

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data.questions;
}
