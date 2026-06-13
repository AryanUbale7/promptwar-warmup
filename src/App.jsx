import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DIETARY_OPTIONS, sanitizeInput, generateMockMealPlan, getFeasibilityColor } from './utils';

// Color definitions (Calm Teal #0D9488, Neutral Grays)
const PRIMARY_TEAL = '#0D9488';
const PRIMARY_TEAL_DARK = '#0F766E';
const PRIMARY_TEAL_LIGHT = '#CCFBF1';
const GRAY_50 = '#F9FAFB';
const GRAY_100 = '#F3F4F6';
const GRAY_200 = '#E5E7EB';
const GRAY_300 = '#D1D5DB';
const GRAY_400 = '#9CA3AF';
const GRAY_500 = '#6B7280';
const GRAY_600 = '#4B5563';
const GRAY_700 = '#374151';
const GRAY_800 = '#1F2937';
const GRAY_900 = '#111827';



function App() {
  // Navigation / Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1 State
  const [dayDescription, setDayDescription] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);
  const [skillLevel, setSkillLevel] = useState('Beginner');

  // Step 2 State
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('INR'); // 'INR' or 'USD'
  const [dietaryRestrictions, setDietaryRestrictions] = useState([]);
  const [ownedIngredients, setOwnedIngredients] = useState('');

  // API Config State
  const [apiKey, setApiKey] = useState(() => {
    return sessionStorage.getItem('CLAUDE_MEAL_PLANNER_API_KEY') || import.meta.env.VITE_CLAUDE_API_KEY || '';
  });
  const [googleApiKey, setGoogleApiKey] = useState(() => {
    return sessionStorage.getItem('GOOGLE_AI_STUDIO_API_KEY') || import.meta.env.VITE_GOOGLE_API_KEY || '';
  });
  const [isDemoMode, setIsDemoMode] = useState(true); // Default to Demo Mode for seamless evaluation

  // Status / Results State
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error' | 'empty'
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState(null);
  
  // UI states
  const [expandedMeal, setExpandedMeal] = useState(null); // 'breakfast' | 'lunch' | 'dinner' | null
  const [copied, setCopied] = useState(false);
  const [focusedChipIndex, setFocusedChipIndex] = useState(-1);

  // References for accessibility focus management
  const stepHeadingRef = useRef(null);
  const chipRefs = useRef([]);

  // Save API key in session storage when changed
  useEffect(() => {
    if (apiKey) {
      sessionStorage.setItem('CLAUDE_MEAL_PLANNER_API_KEY', apiKey);
    } else {
      sessionStorage.removeItem('CLAUDE_MEAL_PLANNER_API_KEY');
    }
  }, [apiKey]);

  // Save Google API key in session storage when changed
  useEffect(() => {
    if (googleApiKey) {
      sessionStorage.setItem('GOOGLE_AI_STUDIO_API_KEY', googleApiKey);
    } else {
      sessionStorage.removeItem('GOOGLE_AI_STUDIO_API_KEY');
    }
  }, [googleApiKey]);

  // Focus step heading when transitioning steps
  useEffect(() => {
    if (stepHeadingRef.current) {
      stepHeadingRef.current.focus();
    }
  }, [currentStep]);

  // Sync chip refs array size
  useEffect(() => {
    chipRefs.current = chipRefs.current.slice(0, DIETARY_OPTIONS.length);
  }, []);

  // Validation Logic
  const validationErrors = useMemo(() => {
    const errors = {};
    if (currentStep === 1) {
      if (dayDescription.trim().length < 20) {
        errors.dayDescription = 'Describe your day in at least 20 characters.';
      }
      const count = parseInt(peopleCount, 10);
      if (isNaN(count) || count < 1 || count > 20) {
        errors.peopleCount = 'Cooking count must be between 1 and 20 people.';
      }
    }
    if (currentStep === 2) {
      const budgetNum = parseFloat(budget);
      if (isNaN(budgetNum) || budgetNum <= 0) {
        errors.budget = 'Please enter a valid daily budget greater than 0.';
      }
      if (!isDemoMode && !apiKey.trim()) {
        errors.apiKey = 'Anthropic API key is not configured in the environment variables (VITE_CLAUDE_API_KEY).';
      }
    }
    return errors;
  }, [currentStep, dayDescription, peopleCount, budget, isDemoMode, apiKey]);

  // Check if current step fields are valid
  const isStep1Valid = Object.keys(validationErrors).filter(k => k === 'dayDescription' || k === 'peopleCount').length === 0 && dayDescription.trim().length > 0;
  const isStep2Valid = Object.keys(validationErrors).length === 0 && budget.trim().length > 0;

  // Next and Back navigation handlers
  const handleNext = () => {
    if (currentStep === 1 && isStep1Valid) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  // Keyboard navigation for multi-select dietary chips
  const handleChipKeyDown = (e, index, option) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleDietary(option);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % DIETARY_OPTIONS.length;
      setFocusedChipIndex(nextIndex);
      chipRefs.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + DIETARY_OPTIONS.length) % DIETARY_OPTIONS.length;
      setFocusedChipIndex(prevIndex);
      chipRefs.current[prevIndex]?.focus();
    }
  };

  const toggleDietary = (option) => {
    setDietaryRestrictions(prev =>
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };



  // Trigger meal generation via API call or mock generator
  const handleGenerate = async () => {
    if (!isStep2Valid) return;

    setStatus('loading');
    setCurrentStep(3);
    setExpandedMeal(null);

    const sanitizedDesc = sanitizeInput(dayDescription);
    const sanitizedIngredients = sanitizeInput(ownedIngredients);
    
    // Prompt structure
    const builtPrompt = `
Generate a daily meal plan with the following user requirements:
- Day Description: "${sanitizedDesc}"
- Number of people to cook for: ${peopleCount}
- Cooking skill level: ${skillLevel}
- Budget: ${currency === 'INR' ? '₹' : '$'}${budget} per day
- Dietary Restrictions: ${dietaryRestrictions.length > 0 ? dietaryRestrictions.join(', ') : 'None'}
- Ingredients already at home: "${sanitizedIngredients || 'None'}"

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

    if (isDemoMode) {
      if (googleApiKey.trim()) {
        // Live Gemini API call
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey.trim()}`, {
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
            const errorText = await response.text();
            throw new Error(`Google AI Studio API error: ${response.status} ${errorText || 'Unknown error'}`);
          }

          const data = await response.json();
          const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (!contentText) {
            throw new Error('Empty response received from Gemini API.');
          }

          let cleanJson = contentText.trim();
          if (cleanJson.startsWith("```")) {
            cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, "");
            cleanJson = cleanJson.replace(/\s*```$/, "");
          }
          cleanJson = cleanJson.trim();

          const parsedData = JSON.parse(cleanJson);
          
          // Validate schema keys
          const required = ['breakfast', 'lunch', 'dinner', 'grocery_list', 'substitutions', 'budget_summary'];
          const missing = required.filter(key => !parsedData.hasOwnProperty(key));
          if (missing.length > 0) {
            throw new Error(`Invalid schema structure from Gemini. Missing keys: ${missing.join(', ')}`);
          }

          const isEmpty = !parsedData.breakfast?.name && !parsedData.lunch?.name && !parsedData.dinner?.name;
          if (isEmpty) {
            setStatus('empty');
          } else {
            setResults(parsedData);
            setStatus('success');
          }
        } catch (err) {
          console.error(err);
          setErrorMsg(err.message || 'An error occurred while connecting to the Gemini API.');
          setStatus('error');
        }
      } else {
        // Fallback to local mock data (No Key)
        setTimeout(() => {
          try {
            const mockPlan = generateMockMealPlan({
              dayDescription: sanitizedDesc,
              peopleCount,
              skillLevel,
              budget,
              currency,
              dietaryRestrictions,
              ownedIngredients: sanitizedIngredients
            });
            
            if (!mockPlan.breakfast?.name && !mockPlan.lunch?.name && !mockPlan.dinner?.name) {
              setStatus('empty');
            } else {
              setResults(mockPlan);
              setStatus('success');
            }
          } catch (err) {
            setErrorMsg('Failed to generate plan. Please try again.');
            setStatus('error');
          }
        }, 1500);
      }
      return;
    }

    // Live Claude API Call configuration
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "dangerously-allow-browser": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: builtPrompt }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned status ${response.status}: ${errorText || 'Unknown error'}`);
      }

      const jsonResponse = await response.json();
      const contentText = jsonResponse.content?.[0]?.text || '';
      
      if (!contentText) {
        throw new Error('Empty response received from Claude API.');
      }

      // Strip any accidental markdown blocks that Claude might return
      let cleanJson = contentText.trim();
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, "");
        cleanJson = cleanJson.replace(/\s*```$/, "");
      }
      cleanJson = cleanJson.trim();

      const parsedData = JSON.parse(cleanJson);

      // Validate schema keys
      const required = ['breakfast', 'lunch', 'dinner', 'grocery_list', 'substitutions', 'budget_summary'];
      const missing = required.filter(key => !parsedData.hasOwnProperty(key));
      if (missing.length > 0) {
        throw new Error(`Invalid schema structure. Missing keys: ${missing.join(', ')}`);
      }

      // Check for empty data arrays/fields
      const isEmpty = !parsedData.breakfast?.name && !parsedData.lunch?.name && !parsedData.dinner?.name;
      if (isEmpty) {
        setStatus('empty');
      } else {
        setResults(parsedData);
        setStatus('success');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred while connecting to the Claude API. Check your connection or key.');
      setStatus('error');
    }
  };

  // Copy to clipboard formatting
  const handleCopyToClipboard = () => {
    if (!results) return;
    const bullet = '•';
    const text = `
DAILY MEAL PLAN (${currency === 'INR' ? '₹' : '$'}${budget} Daily Budget)
==============================================
Breakfast: ${results.breakfast?.name || 'N/A'} (Prep: ${results.breakfast?.prep_time || 'N/A'})
Steps:
${(results.breakfast?.steps || []).map((s, idx) => `  ${idx + 1}. ${s}`).join('\n')}

Lunch: ${results.lunch?.name || 'N/A'} (Prep: ${results.lunch?.prep_time || 'N/A'})
Steps:
${(results.lunch?.steps || []).map((s, idx) => `  ${idx + 1}. ${s}`).join('\n')}

Dinner: ${results.dinner?.name || 'N/A'} (Prep: ${results.dinner?.prep_time || 'N/A'})
Steps:
${(results.dinner?.steps || []).map((s, idx) => `  ${idx + 1}. ${s}`).join('\n')}

GROCERY LIST
----------------------------------------------
${(results.grocery_list || []).map(item => `[ ] ${item.item} (${item.quantity}) - Cost: ${item.estimated_cost}`).join('\n')}

SUBSTITUTIONS
----------------------------------------------
${(results.substitutions || []).map(sub => `${bullet} Swap "${sub.original}" with "${sub.substitute}": ${sub.reason}`).join('\n')}

BUDGET ANALYSIS
----------------------------------------------
Estimated Total: ${results.budget_summary?.total_estimated || 'N/A'}
Budget Feasibility: ${results.budget_summary?.feasibility?.toUpperCase() || 'N/A'}
Tips:
${(results.budget_summary?.tips || []).map(tip => `  ${bullet} ${tip}`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        alert('Could not copy plan to clipboard. Please copy manually.');
      });
  };

  // Reset to Step 1 Form
  const handleReset = () => {
    setCurrentStep(1);
    setStatus('idle');
    setResults(null);
  };



  return (
    <main className="app-container">
      {/* Inline Premium CSS System */}
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          background-color: #F8FAFC;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: ${GRAY_800};
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .app-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem 1rem;
        }

        .card {
          width: 100%;
          max-width: 800px;
          background: #FFFFFF;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          border: 1px solid ${GRAY_100};
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .header-section {
          padding: 1.5rem 2rem;
          border-bottom: 1px solid ${GRAY_100};
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .logo-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: ${PRIMARY_TEAL_DARK};
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .logo-icon {
          width: 28px;
          height: 28px;
          fill: ${PRIMARY_TEAL};
        }

        /* Demo / Live Toggle Mode */
        .api-controls {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: ${GRAY_50};
          padding: 0.375rem 0.75rem;
          border-radius: 9999px;
          border: 1px solid ${GRAY_200};
        }

        .api-toggle-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: ${GRAY_600};
          cursor: pointer;
          user-select: none;
        }

        .switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: ${GRAY_300};
          transition: .3s;
          border-radius: 9999px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .3s;
          border-radius: 50%;
        }

        input:checked + .slider {
          background-color: ${PRIMARY_TEAL};
        }

        input:checked + .slider:before {
          transform: translateX(16px);
        }

        /* Progress Steps */
        .progress-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          position: relative;
          padding: 0.5rem 0;
        }

        .progress-line {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 2px;
          background: ${GRAY_200};
          z-index: 1;
          transform: translateY(-50%);
        }

        .progress-line-fill {
          height: 100%;
          background: ${PRIMARY_TEAL};
          transition: width 0.3s ease;
        }

        .progress-step {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #FFFFFF;
          border: 2px solid ${GRAY_300};
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.875rem;
          color: ${GRAY_500};
          z-index: 2;
          transition: all 0.3s ease;
        }

        .progress-step.active {
          border-color: ${PRIMARY_TEAL};
          color: ${PRIMARY_TEAL};
          background: ${PRIMARY_TEAL_LIGHT};
        }

        .progress-step.completed {
          border-color: ${PRIMARY_TEAL};
          background: ${PRIMARY_TEAL};
          color: #FFFFFF;
        }

        /* Content Areas */
        .content-body {
          padding: 2rem;
        }

        .step-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: ${GRAY_900};
          margin-bottom: 1.5rem;
          outline: none;
        }

        /* Form Grid Layout */
        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        @media (min-width: 768px) {
          .form-grid.two-cols {
            grid-template-columns: 1fr 1fr;
          }
          .col-span-full {
            grid-column: span 2;
          }
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-label {
          font-weight: 600;
          font-size: 0.875rem;
          color: ${GRAY_700};
        }

        .form-control {
          font-family: inherit;
          font-size: 0.9375rem;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          border: 1px solid ${GRAY_300};
          background-color: #FFFFFF;
          color: ${GRAY_900};
          outline: none;
          min-height: 44px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .form-control:focus {
          border-color: ${PRIMARY_TEAL};
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
        }

        textarea.form-control {
          resize: vertical;
          min-height: 100px;
        }

        .error-message {
          color: #DC2626;
          font-size: 0.8125rem;
          font-weight: 500;
        }

        /* Budget with Currency Toggle */
        .budget-input-wrapper {
          display: flex;
          border-radius: 8px;
          border: 1px solid ${GRAY_300};
          overflow: hidden;
          background: #FFFFFF;
        }

        .budget-input-wrapper:focus-within {
          border-color: ${PRIMARY_TEAL};
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
        }

        .budget-input-wrapper .form-control {
          border: none;
          flex-grow: 1;
          box-shadow: none;
        }

        .currency-toggle {
          background: ${GRAY_50};
          border: none;
          border-right: 1px solid ${GRAY_300};
          padding: 0 1rem;
          font-weight: 700;
          color: ${GRAY_600};
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          min-width: 60px;
          justify-content: center;
          font-size: 0.9375rem;
          outline: none;
          transition: background 0.2s ease;
        }

        .currency-toggle:hover {
          background: ${GRAY_100};
        }

        .currency-toggle:focus-visible {
          background: ${GRAY_200};
        }

        /* Keyboard-navigable Chips */
        .chips-container {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }

        .chip {
          background: ${GRAY_100};
          color: ${GRAY_700};
          border: 1px solid ${GRAY_200};
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          user-select: none;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          min-height: 44px;
          outline: none;
        }

        .chip:hover {
          background: ${GRAY_200};
        }

        .chip:focus-visible {
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.4);
          border-color: ${PRIMARY_TEAL};
        }

        .chip.selected {
          background: ${PRIMARY_TEAL};
          color: #FFFFFF;
          border-color: ${PRIMARY_TEAL};
        }

        .chip.selected:hover {
          background: ${PRIMARY_TEAL_DARK};
        }

        /* Keyboard indicator dot inside chip */
        .chip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #FFFFFF;
        }

        /* Footer / Action buttons */
        .content-footer {
          padding: 1.5rem 2rem;
          border-top: 1px solid ${GRAY_100};
          background: ${GRAY_50};
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .btn {
          font-family: inherit;
          font-size: 0.9375rem;
          font-weight: 600;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          border: 1px solid transparent;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          min-height: 48px;
          min-width: 100px;
          transition: all 0.2s ease;
          outline: none;
        }

        .btn-primary {
          background-color: ${PRIMARY_TEAL};
          color: #FFFFFF;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: ${PRIMARY_TEAL_DARK};
        }

        .btn-primary:focus-visible {
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.4);
        }

        .btn-secondary {
          background-color: #FFFFFF;
          color: ${GRAY_700};
          border-color: ${GRAY_300};
        }

        .btn-secondary:hover:not(:disabled) {
          background-color: ${GRAY_50};
          border-color: ${GRAY_400};
        }

        .btn-secondary:focus-visible {
          box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.25);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* API Key banner inside configuration mode */
        .api-key-banner {
          background-color: #EFF6FF;
          border: 1px solid #BFDBFE;
          border-radius: 8px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .api-key-banner-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #1E40AF;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .api-key-banner-desc {
          font-size: 0.8125rem;
          color: #1E3A8A;
          line-height: 1.4;
        }

        /* Results / Success State Display */
        .results-container {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .results-header-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        /* Meal Cards Grid */
        .meals-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        @media (min-width: 1024px) {
          .meals-grid {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }

        .meal-card {
          background: #FFFFFF;
          border: 1px solid ${GRAY_200};
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .meal-card:hover {
          border-color: ${PRIMARY_TEAL};
          box-shadow: 0 4px 12px rgba(13, 148, 136, 0.05);
        }

        .meal-card-header {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          background: ${GRAY_50};
          border-bottom: 1px solid ${GRAY_200};
          cursor: pointer;
          user-select: none;
        }

        .meal-badge {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: ${PRIMARY_TEAL_LIGHT};
          color: ${PRIMARY_TEAL_DARK};
        }

        .meal-title {
          font-size: 1.0625rem;
          font-weight: 700;
          color: ${GRAY_900};
          line-height: 1.3;
        }

        .meal-meta {
          font-size: 0.8125rem;
          color: ${GRAY_500};
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .meal-card-body {
          padding: 1.25rem;
          animation: slideDown 0.2s ease-out;
        }

        .meal-steps-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: ${GRAY_700};
          margin-bottom: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .meal-steps-list {
          list-style-type: none;
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        .meal-step-item {
          font-size: 0.875rem;
          line-height: 1.45;
          color: ${GRAY_600};
          display: flex;
          gap: 0.5rem;
        }

        .meal-step-num {
          color: ${PRIMARY_TEAL};
          font-weight: 700;
          min-width: 18px;
        }

        /* Tables & Lists */
        .grocery-section {
          background: #FFFFFF;
          border: 1px solid ${GRAY_200};
          border-radius: 12px;
          overflow: hidden;
        }

        .section-header {
          padding: 1.25rem 1.5rem;
          background: ${GRAY_50};
          border-bottom: 1px solid ${GRAY_200};
          font-size: 1rem;
          font-weight: 700;
          color: ${GRAY_900};
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .table-responsive {
          width: 100%;
          overflow-x: auto;
        }

        .grocery-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .grocery-table th {
          background: ${GRAY_50};
          font-size: 0.75rem;
          text-transform: uppercase;
          font-weight: 700;
          color: ${GRAY_500};
          padding: 0.75rem 1.5rem;
          border-bottom: 1px solid ${GRAY_200};
          letter-spacing: 0.05em;
        }

        .grocery-table td {
          padding: 1rem 1.5rem;
          font-size: 0.875rem;
          color: ${GRAY_700};
          border-bottom: 1px solid ${GRAY_100};
        }

        .grocery-table tr:last-child td {
          border-bottom: none;
        }

        /* Feasibility & Substitutions layout */
        .summary-split {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        @media (min-width: 768px) {
          .summary-split {
            grid-template-columns: 1fr 1fr;
          }
        }

        .feasibility-box {
          background: #FFFFFF;
          border: 1px solid ${GRAY_200};
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .feasibility-badge-wrapper {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .feasibility-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.875rem;
          border-radius: 9999px;
          font-size: 0.8125rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid transparent;
        }

        .badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .tips-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding-left: 1.25rem;
          font-size: 0.875rem;
          color: ${GRAY_600};
          line-height: 1.45;
        }

        .substitutions-box {
          background: #FFFFFF;
          border: 1px solid ${GRAY_200};
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .sub-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .sub-item {
          font-size: 0.875rem;
          color: ${GRAY_700};
          line-height: 1.45;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid ${GRAY_100};
        }

        .sub-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        /* Loading Spinner & States overlay */
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          text-align: center;
          gap: 1.5rem;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid ${GRAY_200};
          border-top-color: ${PRIMARY_TEAL};
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .loading-message {
          font-size: 1.125rem;
          font-weight: 600;
          color: ${GRAY_700};
        }

        .loading-subtitle {
          font-size: 0.875rem;
          color: ${GRAY_500};
        }

        /* Error States */
        .error-container {
          background-color: #FEF2F2;
          border: 1px solid #FCA5A5;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .error-icon {
          width: 48px;
          height: 48px;
          fill: #DC2626;
        }

        .error-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: #991B1B;
        }

        .error-desc {
          font-size: 0.875rem;
          color: #7F1D1D;
          max-width: 500px;
          line-height: 1.5;
        }

        /* Empty States */
        .empty-container {
          text-align: center;
          padding: 4rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
        }

        .empty-icon {
          width: 64px;
          height: 64px;
          fill: ${GRAY_300};
        }

        .empty-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: ${GRAY_700};
        }

        .empty-desc {
          font-size: 0.875rem;
          color: ${GRAY_500};
          max-width: 400px;
          line-height: 1.5;
        }

        /* Animations */
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="card">
        {/* Step 1 & 2 Header Section */}
        {currentStep <= 2 && (
          <header className="header-section">
            <div className="header-top">
              <div className="logo-title">
                {/* Embedded SVG Logo for Visual Polish */}
                <svg className="logo-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.39.04-.08.08-.17.11-.27.42-1.28.79-2.58 1.15-3.89.07-.25-.01-.52-.2-.7L8.23 15.1c-.26-.26-.26-.69 0-.95l3.22-3.22c.26-.26.69-.26.95 0l1.67 1.67c.18.18.45.27.7.2.98-.27 1.95-.57 2.91-.9 0-.15-.02-.3-.06-.44-.42-1.28-.79-2.58-1.15-3.89-.07-.25.01-.52.2-.7l1.67-1.67c.26-.26.69-.26.95 0l1.1 1.1c.14.14.33.22.53.22.42 0 .82-.17 1.11-.47L22 4.41c-.42-.81-1.01-1.5-1.72-2.05L18.66 4c-.26.26-.69.26-.95 0l-1.1-1.1c-.26-.26-.26-.69 0-.95l1.67-1.67c.07-.07.12-.16.14-.26C16.29 2.02 14.18 2 12 2zm1 8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
                </svg>
                <span>Curated Meal Planner</span>
              </div>

              {/* API Configuration & Mode Switcher */}
              <div className="api-controls" role="group" aria-label="API Integration Mode">
                <span 
                  className="api-toggle-label" 
                  onClick={() => setIsDemoMode(!isDemoMode)}
                  id="mode-toggle-label"
                >
                  {isDemoMode ? 'Demo Mode' : 'Live API Mode'}
                </span>
                <label className="switch" aria-labelledby="mode-toggle-label">
                  <input 
                    type="checkbox" 
                    checked={!isDemoMode}
                    onChange={(e) => setIsDemoMode(!e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>



            {/* Guided Flow Progress Steps */}
            <div className="progress-container" aria-label="Progress Tracker">
              <div 
                className="progress-line" 
                style={{ zIndex: 1 }}
              >
                <div 
                  className="progress-line-fill" 
                  style={{ width: `${(currentStep - 1) * 50}%` }}
                ></div>
              </div>
              <div 
                className={`progress-step ${currentStep >= 1 ? 'completed' : ''} active`} 
                aria-current={currentStep === 1 ? 'step' : undefined}
              >
                {currentStep > 1 ? '✓' : '1'}
              </div>
              <div 
                className={`progress-step ${currentStep > 2 ? 'completed' : currentStep === 2 ? 'active' : ''}`}
                aria-current={currentStep === 2 ? 'step' : undefined}
              >
                {currentStep > 2 ? '✓' : '2'}
              </div>
              <div 
                className={`progress-step ${currentStep === 3 ? 'active' : ''}`}
                aria-current={currentStep === 3 ? 'step' : undefined}
              >
                3
              </div>
            </div>
          </header>
        )}

        {/* Dynamic Wizard Steps Rendering */}
        <div className="content-body">
          {/* STEP 1: Describe Your Day */}
          {currentStep === 1 && (
            <section aria-labelledby="step-1-title">
              <h2 
                id="step-1-title" 
                className="step-title" 
                tabIndex="-1" 
                ref={stepHeadingRef}
              >
                Step 1: Describe Your Day
              </h2>
              
              <div className="form-grid two-cols">
                <div className="form-group col-span-full">
                  <label htmlFor="day-desc-input" className="form-label">
                    What does your day look like? *
                  </label>
                  <textarea
                    id="day-desc-input"
                    className="form-control"
                    placeholder="Examples: Busy workday with back-to-back meetings, light dinner, need high energy meals; or relaxed weekend with a long family lunch..."
                    value={dayDescription}
                    onChange={(e) => setDayDescription(e.target.value)}
                    aria-describedby="desc-error desc-hint"
                    required
                  />
                  <span id="desc-hint" style={{ fontSize: '0.75rem', color: GRAY_500 }}>
                    Enter at least 20 characters describing your scheduled events, energy levels, or constraints. ({dayDescription.length}/20)
                  </span>
                  {validationErrors.dayDescription && dayDescription.trim().length > 0 && (
                    <span className="error-message" id="desc-error" role="alert">
                      {validationErrors.dayDescription}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="people-count-input" className="form-label">
                    How many people are you cooking for? *
                  </label>
                  <input
                    id="people-count-input"
                    type="number"
                    min="1"
                    max="20"
                    className="form-control"
                    value={peopleCount}
                    onChange={(e) => setPeopleCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                    aria-describedby="people-error"
                    required
                  />
                  {validationErrors.peopleCount && (
                    <span className="error-message" id="people-error" role="alert">
                      {validationErrors.peopleCount}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="skill-level-select" className="form-label">
                    What's your cooking skill level?
                  </label>
                  <select
                    id="skill-level-select"
                    className="form-control"
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(e.target.value)}
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* STEP 2: Budget & Preferences */}
          {currentStep === 2 && (
            <section aria-labelledby="step-2-title">
              <h2 
                id="step-2-title" 
                className="step-title" 
                tabIndex="-1" 
                ref={stepHeadingRef}
              >
                Step 2: Budget & Preferences
              </h2>

              {!isDemoMode && !apiKey.trim() && (
                <div className="error-message" style={{ margin: '0 0 1.5rem 0', padding: '0.75rem 1rem', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px solid #FCA5A5', lineHeight: '1.4' }}>
                  <strong>Configuration Required:</strong> Anthropic API Key (<code>VITE_CLAUDE_API_KEY</code>) is not configured in the environment variables. Please configure it in your Netlify site settings or local env to use Live API Mode.
                </div>
              )}

              <div className="form-grid two-cols">
                <div className="form-group">
                  <label htmlFor="budget-input" className="form-label">
                    Daily food budget? *
                  </label>
                  <div className="budget-input-wrapper">
                    <button 
                      type="button" 
                      className="currency-toggle" 
                      onClick={() => setCurrency(prev => prev === 'INR' ? 'USD' : 'INR')}
                      aria-label={`Current currency: ${currency}. Click to toggle.`}
                    >
                      {currency === 'INR' ? '₹ (INR)' : '$ (USD)'}
                    </button>
                    <input
                      id="budget-input"
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="e.g. 500 or 25"
                      className="form-control"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      aria-describedby="budget-error"
                      required
                    />
                  </div>
                  {validationErrors.budget && budget.trim().length > 0 && (
                    <span className="error-message" id="budget-error" role="alert">
                      {validationErrors.budget}
                    </span>
                  )}
                </div>

                <div className="form-group col-span-full">
                  <span className="form-label" id="diet-group-label">Dietary restrictions</span>
                  <span style={{ fontSize: '0.75rem', color: GRAY_500, marginBottom: '0.25rem' }}>
                    Select all that apply. Navigable via keyboard arrow keys, space/enter to select.
                  </span>
                  <div 
                    className="chips-container" 
                    role="group" 
                    aria-labelledby="diet-group-label"
                  >
                    {DIETARY_OPTIONS.map((option, index) => {
                      const isSelected = dietaryRestrictions.includes(option);
                      return (
                        <div
                          key={option}
                          ref={el => chipRefs.current[index] = el}
                          className={`chip ${isSelected ? 'selected' : ''}`}
                          role="checkbox"
                          aria-checked={isSelected}
                          tabIndex={focusedChipIndex === index || (focusedChipIndex === -1 && index === 0) ? 0 : -1}
                          onClick={() => toggleDietary(option)}
                          onKeyDown={(e) => handleChipKeyDown(e, index, option)}
                          onFocus={() => setFocusedChipIndex(index)}
                        >
                          {isSelected && <span className="chip-dot" />}
                          <span>{option}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group col-span-full">
                  <label htmlFor="owned-ingredients-input" className="form-label">
                    Any ingredients you already have at home?
                  </label>
                  <input
                    id="owned-ingredients-input"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Rice, Potatoes, Onions, Olive oil (comma-separated)"
                    value={ownedIngredients}
                    onChange={(e) => setOwnedIngredients(e.target.value)}
                  />
                </div>
              </div>
            </section>
          )}

          {/* STEP 3: Results Display */}
          {currentStep === 3 && (
            <div 
              aria-live="polite" 
              aria-busy={status === 'loading'}
            >
              {/* Status: Loading Spinner */}
              {status === 'loading' && (
                <div className="loading-container">
                  <div className="spinner" role="status" aria-label="Loading spinner"></div>
                  <div>
                    <h3 className="loading-message">Planning your meals…</h3>
                    <p className="loading-subtitle">Optimizing costs, scaling quantities, and formatting steps...</p>
                  </div>
                </div>
              )}

              {/* Status: Error Banner */}
              {status === 'error' && (
                <div className="error-container">
                  <svg className="error-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h-2v2H7v-6h10v6zm0-8h-2V7h2v2z" />
                  </svg>
                  <h3 className="error-title">Generation Failed</h3>
                  <p className="error-desc">{errorMsg}</p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <button type="button" className="btn btn-primary" onClick={handleGenerate}>
                      Try Again
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={handleReset}>
                      Go Back to Form
                    </button>
                  </div>
                </div>
              )}

              {/* Status: Empty Banner */}
              {status === 'empty' && (
                <div className="empty-container">
                  <svg className="empty-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z" />
                  </svg>
                  <h3 className="empty-title">No Meal Plan Found</h3>
                  <p className="empty-desc">The AI was unable to generate meals matching your parameters. Try relaxing your budget or dietary constraints.</p>
                  <button type="button" className="btn btn-primary" onClick={handleReset} style={{ marginTop: '0.5rem' }}>
                    Modify Settings
                  </button>
                </div>
              )}

              {/* Status: Success Layout */}
              {status === 'success' && results && (
                <section className="results-container" aria-labelledby="results-main-title">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 
                      id="results-main-title" 
                      className="step-title" 
                      style={{ marginBottom: 0 }}
                      tabIndex="-1"
                      ref={stepHeadingRef}
                    >
                      Your Customized Daily Meal Plan
                    </h2>
                    
                    {/* Action buttons */}
                    <div className="results-header-actions">
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={handleCopyToClipboard}
                        aria-label="Copy entire plan to clipboard"
                      >
                        {copied ? '✓ Copied!' : 'Copy to Clipboard'}
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        onClick={handleGenerate}
                        aria-label="Regenerate meal plan"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>

                  {/* Meal Plan expandable cards */}
                  <div className="meals-grid">
                    {/* BREAKFAST CARD */}
                    <article className="meal-card" aria-labelledby="breakfast-title">
                      <div 
                        className="meal-card-header"
                        onClick={() => setExpandedMeal(expandedMeal === 'breakfast' ? null : 'breakfast')}
                        role="button"
                        aria-expanded={expandedMeal === 'breakfast'}
                      >
                        <span className="meal-badge">Breakfast</span>
                        <h3 id="breakfast-title" className="meal-title">{results.breakfast?.name || 'Breakfast'}</h3>
                        <div className="meal-meta">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                          </svg>
                          <span>Prep: {results.breakfast?.prep_time || 'N/A'}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
                            {expandedMeal === 'breakfast' ? '− Hide steps' : '+ Show steps'}
                          </span>
                        </div>
                      </div>
                      
                      {expandedMeal === 'breakfast' && (
                        <div className="meal-card-body">
                          <h4 className="meal-steps-title">Preparation Steps</h4>
                          <ol className="meal-steps-list">
                            {(results.breakfast?.steps || []).map((step, idx) => (
                              <li key={idx} className="meal-step-item">
                                <span className="meal-step-num">{idx + 1}</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </article>

                    {/* LUNCH CARD */}
                    <article className="meal-card" aria-labelledby="lunch-title">
                      <div 
                        className="meal-card-header"
                        onClick={() => setExpandedMeal(expandedMeal === 'lunch' ? null : 'lunch')}
                        role="button"
                        aria-expanded={expandedMeal === 'lunch'}
                      >
                        <span className="meal-badge">Lunch</span>
                        <h3 id="lunch-title" className="meal-title">{results.lunch?.name || 'Lunch'}</h3>
                        <div className="meal-meta">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                          </svg>
                          <span>Prep: {results.lunch?.prep_time || 'N/A'}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
                            {expandedMeal === 'lunch' ? '− Hide steps' : '+ Show steps'}
                          </span>
                        </div>
                      </div>
                      
                      {expandedMeal === 'lunch' && (
                        <div className="meal-card-body">
                          <h4 className="meal-steps-title">Preparation Steps</h4>
                          <ol className="meal-steps-list">
                            {(results.lunch?.steps || []).map((step, idx) => (
                              <li key={idx} className="meal-step-item">
                                <span className="meal-step-num">{idx + 1}</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </article>

                    {/* DINNER CARD */}
                    <article className="meal-card" aria-labelledby="dinner-title">
                      <div 
                        className="meal-card-header"
                        onClick={() => setExpandedMeal(expandedMeal === 'dinner' ? null : 'dinner')}
                        role="button"
                        aria-expanded={expandedMeal === 'dinner'}
                      >
                        <span className="meal-badge">Dinner</span>
                        <h3 id="dinner-title" className="meal-title">{results.dinner?.name || 'Dinner'}</h3>
                        <div className="meal-meta">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                          </svg>
                          <span>Prep: {results.dinner?.prep_time || 'N/A'}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
                            {expandedMeal === 'dinner' ? '− Hide steps' : '+ Show steps'}
                          </span>
                        </div>
                      </div>
                      
                      {expandedMeal === 'dinner' && (
                        <div className="meal-card-body">
                          <h4 className="meal-steps-title">Preparation Steps</h4>
                          <ol className="meal-steps-list">
                            {(results.dinner?.steps || []).map((step, idx) => (
                              <li key={idx} className="meal-step-item">
                                <span className="meal-step-num">{idx + 1}</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </article>
                  </div>

                  {/* Grocery List Section */}
                  <article className="grocery-section" aria-labelledby="grocery-title">
                    <div className="section-header" id="grocery-title">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
                      </svg>
                      <span>Scaled Grocery List ({peopleCount} {peopleCount === 1 ? 'Person' : 'People'})</span>
                    </div>
                    <div className="table-responsive">
                      <table className="grocery-table">
                        <thead>
                          <tr>
                            <th scope="col">Ingredients</th>
                            <th scope="col">Required Quantity</th>
                            <th scope="col">Estimated Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(results.grocery_list || []).map((item, index) => (
                            <tr key={index}>
                              <td>{item.item}</td>
                              <td>{item.quantity}</td>
                              <td>{item.estimated_cost}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  {/* Budget feasibility & substitutions info split grid */}
                  <div className="summary-split">
                    {/* Budget feasibility box */}
                    <article className="feasibility-box" aria-labelledby="feasibility-title">
                      <div className="feasibility-badge-wrapper">
                        <h3 
                          id="feasibility-title" 
                          style={{ fontSize: '0.9375rem', fontWeight: 700, color: GRAY_800 }}
                        >
                          Budget Feasibility Analysis
                        </h3>
                        {(() => {
                          const conf = getFeasibilityColor(results.budget_summary?.feasibility);
                          return (
                            <span 
                              className="feasibility-badge"
                              style={{ backgroundColor: conf.bg, color: conf.text, borderColor: conf.border }}
                            >
                              <span className="badge-dot" style={{ backgroundColor: conf.dot }} />
                              <span>{results.budget_summary?.feasibility}</span>
                            </span>
                          );
                        })()}
                      </div>
                      
                      <div style={{ fontSize: '0.875rem', color: GRAY_700 }}>
                        <strong>Estimated Cost:</strong> {results.budget_summary?.total_estimated || 'N/A'} (Limit: {currency === 'INR' ? '₹' : '$'}{budget})
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.8125rem', color: GRAY_500, textTransform: 'uppercase' }}>Tips & Tricks</strong>
                        <ul className="tips-list">
                          {(results.budget_summary?.tips || []).map((tip, idx) => (
                            <li key={idx}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    </article>

                    {/* Substitutions box */}
                    <article className="substitutions-box" aria-labelledby="substitutions-title">
                      <h3 
                        id="substitutions-title" 
                        style={{ fontSize: '0.9375rem', fontWeight: 700, color: GRAY_800 }}
                      >
                        Dietary Substitutions & Prep Hacks
                      </h3>
                      
                      <div className="sub-list">
                        {(results.substitutions || []).length === 0 ? (
                          <p style={{ fontSize: '0.875rem', color: GRAY_500 }}>No substitutions required for this plan.</p>
                        ) : (
                          (results.substitutions || []).map((sub, idx) => (
                            <div key={idx} className="sub-item">
                              <div><strong>Original:</strong> {sub.original}</div>
                              <div><strong>Substitute:</strong> <span style={{ color: PRIMARY_TEAL_DARK, fontWeight: '600' }}>{sub.substitute}</span></div>
                              <div style={{ fontSize: '0.8125rem', color: GRAY_500, marginTop: '0.25rem' }}>
                                <em>Reason:</em> {sub.reason}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </article>
                  </div>

                  {/* Reset/Modify Parameters */}
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                    <button type="button" className="btn btn-secondary" onClick={handleReset} style={{ minWidth: '160px' }}>
                      Change Parameters
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Action button footer bar for step 1 & 2 */}
        {currentStep <= 2 && (
          <footer className="content-footer">
            {currentStep === 1 ? (
              <div /> // Spacer
            ) : (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleBack}
                aria-label="Back to step 1"
              >
                Back
              </button>
            )}

            {currentStep === 1 ? (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleNext}
                disabled={!isStep1Valid}
                aria-label="Proceed to step 2"
              >
                Next
              </button>
            ) : (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleGenerate}
                disabled={!isStep2Valid}
                aria-label="Generate meal plan"
              >
                Generate Plan
              </button>
            )}
          </footer>
        )}
      </div>
    </main>
  );
}

export default App;
