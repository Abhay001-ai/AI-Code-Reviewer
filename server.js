import 'dotenv/config';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const reviewPrompt = (code, language) => `You are a meticulous senior software engineer performing a code review.

Review the following ${language} code. Look for correctness bugs, security risks, performance problems, maintainability concerns, and strong positive patterns. Be specific and practical. Do not invent issues. If the code is sound, say so.

Return ONLY valid JSON with this exact shape:
{
  "summary": "2-3 sentence overview",
  "score": 0,
  "findings": [
    {
      "severity": "critical|warning|suggestion|positive",
      "title": "short finding title",
      "line": "line number or range, or 'General'",
      "explanation": "what is happening and why it matters",
      "recommendation": "a concrete improvement"
    }
  ]
}

The score must be an integer from 0 to 100. Keep findings concise and prioritize the most important items.

CODE:
\`\`\`${language}
${code}
\`\`\``;


// Retry Gemini when it temporarily returns 503
async function generateReview(prompt, maxRetries = 4) {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Gemini request attempt ${attempt + 1}/${maxRetries + 1}`);

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      return response;

    } catch (error) {
      const status = error?.status || error?.code;

      // Retry only temporary server overload errors
      if (status === 503 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;

        console.log(
          `Gemini is temporarily unavailable. Retrying in ${delay / 1000} seconds...`
        );

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }
}


app.post('/api/review', async (req, res) => {
  const { code, language = 'javascript' } = req.body;

  if (!code || typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({
      error: 'Paste some code to review.'
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured. Add it to your .env file first.'
    });
  }

  try {
    const response = await generateReview(
      reviewPrompt(code.slice(0, 30000), language)
    );

    const review = JSON.parse(response.text);

    return res.json(review);

  } catch (error) {
    console.error('Review failed:', error);

    const status = error?.status || error?.code;

    if (status === 503) {
      return res.status(503).json({
        error: 'Gemini is temporarily overloaded. Please try again in a few seconds.'
      });
    }

    if (status === 429) {
      return res.status(429).json({
        error: 'Gemini API rate limit reached. Please wait and try again.'
      });
    }

    if (status === 401 || status === 403) {
      return res.status(401).json({
        error: 'Gemini API key is invalid or does not have access to this model.'
      });
    }

    return res.status(500).json({
      error: 'The review could not be completed. Please try again.'
    });
  }
});


app.get('*splat', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


if (!process.env.GEMINI_API_KEY) {
  console.warn(
    'GEMINI_API_KEY is missing. Create a .env file before using code review.'
  );
}


app.listen(port, () => {
  console.log(`Code Reviewer running at http://localhost:${port}`);
});

