import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env.local if present, otherwise .env
const localEnvPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else {
  dotenv.config();
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Escapes double quotes to prevent prompt injection
function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/"/g, '\\"');
}

// Strip HTML and JSON brackets for prompt safety
function sanitizeInput(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>?/gm, '') // Strip HTML
    .replace(/[{}[\]\\]/g, ' ') // Strip raw brackets
    .trim();
}

app.post('/api/generate', async (req, res) => {
  const {
    dayDescription,
    peopleCount,
    skillLevel,
    budget,
    currency,
    dietaryRestrictions = [],
    ownedIngredients,
    provider = 'gemini'
  } = req.body;

  // Basic validation
  if (!dayDescription || dayDescription.trim().length < 20) {
    return res.status(400).json({ error: 'Description must be at least 20 characters.' });
  }
  const count = parseInt(peopleCount, 10);
  if (isNaN(count) || count < 1 || count > 20) {
    return res.status(400).json({ error: 'People count must be between 1 and 20.' });
  }
  const budgetVal = parseFloat(budget);
  if (isNaN(budgetVal) || budgetVal <= 0) {
    return res.status(400).json({ error: 'Budget must be greater than 0.' });
  }

  // Sanitize and escape inputs
  const cleanDesc = escapeQuotes(sanitizeInput(dayDescription));
  const cleanIngredients = escapeQuotes(sanitizeInput(ownedIngredients));

  // Build the prompt securely
  const builtPrompt = `
Generate a daily meal plan with the following user requirements:
- Day Description: "${cleanDesc}"
- Number of people to cook for: ${count}
- Cooking skill level: ${skillLevel}
- Budget: ${currency === 'INR' ? '₹' : '$'}${budgetVal} per day
- Dietary Restrictions: ${dietaryRestrictions.length > 0 ? dietaryRestrictions.join(', ') : 'None'}
- Ingredients already at home: "${cleanIngredients || 'None'}"

You MUST respond with a single, valid JSON object that conforms EXACTLY to the following schema:
{
  "breakfast": { "name": "string", "prep_time": "string", "steps": ["string", "string"] },
  "lunch": { "name": "string", "prep_time": "string", "steps": ["string", "string"] },
  "dinner": { "name": "string", "prep_time": "string", "steps": ["string", "string"] },
  "grocery_list": [
    { "item": "string", "quantity": "string", "estimated_cost": "string" }
  ],
  "substitutions": [
    { "original": "string", "substitute": "string", "reason": "string" }
  ],
  "budget_summary": { 
    "total_estimated": "string", 
    "feasibility": "low" | "medium" | "high", 
    "tips": ["string", "string"] 
  }
}

Respond ONLY with the JSON object. Do not wrap in markdown \`\`\`json blocks. Do not add any preamble or markdown fences.
`;

  try {
    if (provider === 'gemini') {
      const googleApiKey = req.body.googleApiKey || process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
      if (!googleApiKey || !googleApiKey.trim()) {
        return res.status(400).json({ error: 'Google API Key is not configured on the server.' });
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${googleApiKey.trim()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: builtPrompt
            }]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!contentText) {
        throw new Error('Empty response received from Gemini.');
      }

      let cleanJson = contentText.trim();
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, "");
        cleanJson = cleanJson.replace(/\s*```$/, "");
      }
      cleanJson = cleanJson.trim();

      const parsedData = JSON.parse(cleanJson);
      return res.json(parsedData);

    } else if (provider === 'claude') {
      const claudeApiKey = req.body.apiKey || process.env.VITE_CLAUDE_API_KEY || process.env.CLAUDE_API_KEY;
      if (!claudeApiKey || !claudeApiKey.trim()) {
        return res.status(400).json({ error: 'Claude API Key is not configured on the server.' });
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": claudeApiKey.trim(),
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 1000,
          messages: [{ role: "user", content: builtPrompt }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const contentText = data.content?.[0]?.text || '';
      if (!contentText) {
        throw new Error('Empty response received from Claude.');
      }

      let cleanJson = contentText.trim();
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, "");
        cleanJson = cleanJson.replace(/\s*```$/, "");
      }
      cleanJson = cleanJson.trim();

      const parsedData = JSON.parse(cleanJson);
      return res.json(parsedData);
    } else {
      return res.status(400).json({ error: `Unsupported API provider: ${provider}` });
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ error: error.message || 'Error occurred during generation.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend proxy server listening on port ${PORT}`);
});
