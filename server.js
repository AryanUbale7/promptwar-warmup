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
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.netlify.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Escapes double quotes
function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/"/g, '\\"');
}

// Strict Prompt Injection Sanitizer
function sanitizeInput(text) {
  if (!text) return '';
  let cleaned = text
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/[{}[\]\\]/g, ' ') // Strip raw brackets/braces
    .replace(/[`<>]/g, '') // Strip backticks, <, >
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\n{3,}/g, '\n\n'); // Clamp newlines to max 2 consecutive

  // Remove prompt injection keywords (case-insensitive)
  const blocked = [
    /ignore previous instructions/gi,
    /system:/gi,
    /assistant:/gi
  ];
  for (const pattern of blocked) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

// Schema Validator
function validateMealPlanSchema(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error("SCHEMA_VALIDATION_FAILED");
  const topKeys = ['breakfast', 'lunch', 'dinner', 'grocery_list', 'substitutions', 'budget_summary'];
  for (const k of topKeys) {
    if (!(k in parsed)) throw new Error("SCHEMA_VALIDATION_FAILED");
  }
  
  const validateMeal = (meal) => {
    if (!meal || typeof meal !== 'object') throw new Error("SCHEMA_VALIDATION_FAILED");
    if (typeof meal.name !== 'string' || !meal.name.trim()) throw new Error("SCHEMA_VALIDATION_FAILED");
    if (typeof meal.prep_time !== 'string' || !meal.prep_time.trim()) throw new Error("SCHEMA_VALIDATION_FAILED");
    if (!Array.isArray(meal.steps) || meal.steps.length === 0) throw new Error("SCHEMA_VALIDATION_FAILED");
    for (const s of meal.steps) {
      if (typeof s !== 'string' || !s.trim()) throw new Error("SCHEMA_VALIDATION_FAILED");
    }
  };

  validateMeal(parsed.breakfast);
  validateMeal(parsed.lunch);
  validateMeal(parsed.dinner);

  if (!Array.isArray(parsed.grocery_list)) throw new Error("SCHEMA_VALIDATION_FAILED");
  for (const item of parsed.grocery_list) {
    if (!item || typeof item !== 'object') throw new Error("SCHEMA_VALIDATION_FAILED");
    if (typeof item.item !== 'string' || !item.item.trim()) throw new Error("SCHEMA_VALIDATION_FAILED");
    if (typeof item.quantity !== 'string' || !item.quantity.trim()) throw new Error("SCHEMA_VALIDATION_FAILED");
    if (typeof item.estimated_cost !== 'string' || !item.estimated_cost.trim()) throw new Error("SCHEMA_VALIDATION_FAILED");
  }

  if (!Array.isArray(parsed.substitutions)) throw new Error("SCHEMA_VALIDATION_FAILED");
  for (const sub of parsed.substitutions) {
    if (!sub || typeof sub !== 'object') throw new Error("SCHEMA_VALIDATION_FAILED");
    if (typeof sub.original !== 'string' || typeof sub.substitute !== 'string' || typeof sub.reason !== 'string') {
      throw new Error("SCHEMA_VALIDATION_FAILED");
    }
  }

  const bs = parsed.budget_summary;
  if (!bs || typeof bs !== 'object') throw new Error("SCHEMA_VALIDATION_FAILED");
  if (typeof bs.total_estimated !== 'string' || !bs.total_estimated.trim()) throw new Error("SCHEMA_VALIDATION_FAILED");
  if (!['low', 'medium', 'high'].includes(String(bs.feasibility).toLowerCase())) throw new Error("SCHEMA_VALIDATION_FAILED");
  if (!Array.isArray(bs.tips)) throw new Error("SCHEMA_VALIDATION_FAILED");
  for (const tip of bs.tips) {
    if (typeof tip !== 'string' || !tip.trim()) throw new Error("SCHEMA_VALIDATION_FAILED");
  }

  return true;
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

  const parsedBudget = parseFloat(budget);
  if (isNaN(parsedBudget) || parsedBudget <= 0) {
    return res.status(400).json({ error: 'Budget must be greater than 0.' });
  }
  
  // Clamp numeric values securely
  const count = Math.min(20, Math.max(1, parseInt(peopleCount, 10) || 1));
  const budgetVal = Math.min(100000, Math.max(1, parsedBudget));

  // Sanitize and escape inputs
  const cleanDesc = sanitizeInput(dayDescription);
  const cleanIngredients = sanitizeInput(ownedIngredients);

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
      validateMealPlanSchema(parsedData);
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
      validateMealPlanSchema(parsedData);
      return res.json(parsedData);
    } else {
      return res.status(400).json({ error: `Unsupported API provider: ${provider}` });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Proxy Error:', error);
    }

    let errorType = 'ERR_UNKNOWN';
    let errorMessage = 'An unexpected error occurred. Please try again.';

    if (error.message === 'SCHEMA_VALIDATION_FAILED') {
      errorType = 'ERR_SCHEMA';
      errorMessage = 'The meal plan was incomplete. Please regenerate.';
    } else if (error instanceof SyntaxError) {
      errorType = 'ERR_PARSE';
      errorMessage = 'The meal plan response was unreadable. Please regenerate.';
    } else if (error.message.includes('fetch') || error.message.includes('network') || error.code === 'ENOTFOUND') {
      errorType = 'ERR_NETWORK';
      errorMessage = 'Connection failed. Check your internet and try again.';
    } else if (error.message.includes('timeout') || error.message.includes('abort')) {
      errorType = 'ERR_TIMEOUT';
      errorMessage = 'Request timed out. Please try again.';
    }

    return res.status(500).json({ error: errorMessage, type: errorType });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend proxy server listening on port ${PORT}`);
  });
}

export default app;
