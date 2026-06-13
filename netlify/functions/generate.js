// Netlify Serverless Function: netlify/functions/generate.js
// Handles POST requests to /api/generate securely in production on Netlify.

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

export async function handler(event, context) {
  const origin = event.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  const isAllowed = !origin || allowedOrigins.includes(origin) || origin.endsWith('.netlify.app');
  if (!isAllowed) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'CORS policy violation' })
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const {
      dayDescription,
      peopleCount,
      skillLevel,
      budget,
      currency,
      dietaryRestrictions = [],
      ownedIngredients,
      provider = 'gemini',
      googleApiKey: clientGoogleKey
    } = payload;

    // Basic validation
    if (!dayDescription || dayDescription.trim().length < 20) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Description must be at least 20 characters.' })
      };
    }
    const count = parseInt(peopleCount, 10);
    if (isNaN(count) || count < 1 || count > 20) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'People count must be between 1 and 20.' })
      };
    }
    const budgetVal = parseFloat(budget);
    if (isNaN(budgetVal) || budgetVal <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Budget must be greater than 0.' })
      };
    }

    // Sanitize and escape inputs
    const cleanDesc = escapeQuotes(sanitizeInput(dayDescription));
    const cleanIngredients = escapeQuotes(sanitizeInput(ownedIngredients));

    // Build prompt securely
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

    // Retrieve Google API Key (either passed from client override or loaded from server env)
    const googleApiKey = clientGoogleKey || process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
    if (!googleApiKey || !googleApiKey.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Google API Key is not configured on the Netlify server. Set VITE_GOOGLE_API_KEY in the Netlify variables.' })
      };
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
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Google API error: ${response.status} - ${errText}` })
      };
    }

    const data = await response.json();
    const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!contentText) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Empty response received from Gemini.' })
      };
    }

    let cleanJson = contentText.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, "");
      cleanJson = cleanJson.replace(/\s*```$/, "");
    }
    cleanJson = cleanJson.trim();

    const parsedData = JSON.parse(cleanJson);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(parsedData)
    };

  } catch (error) {
    console.error('Serverless Function Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Error occurred during generation.' })
    };
  }
}
