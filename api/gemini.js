export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel' });
  }

  const { prompt, preferredModel } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const models = [preferredModel, 'gemini-2.5-flash', 'gemini-2.0-flash'].filter(Boolean);
  const payload = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    }
  });

  const tried = [];

  for (const model of models) {
    // Vertex AI Express endpoint (for AQ. keys) + standard Gemini endpoint
    const endpoints = [
      `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
    ];

    for (const url of endpoints) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });

        if (!r.ok) {
          const errText = await r.text();
          const match = /"message":\s*"([^"]+)"/.exec(errText);
          const msg = match ? match[1] : errText.slice(0, 120);
          tried.push(`${model} (HTTP ${r.status}: ${msg})`);
          continue;
        }

        const data = await r.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const text = parts.map((p) => p.text || '').join('');
        if (!text) continue;

        return res.status(200).json({ model, text });
      } catch (e) {
        tried.push(`${model} (${e.message})`);
      }
    }
  }

  return res.status(502).json({ error: `Key failed or revoked. Details: ${tried.join('; ')}` });
}