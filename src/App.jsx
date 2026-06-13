import React, { useState, useEffect, useRef, useMemo } from 'react';
import { sanitizeInput, generateMockMealPlan } from './utils';
import ProgressTracker from './components/ProgressTracker';
import Step1 from './components/Step1';
import Step2 from './components/Step2';
import ResultsView from './components/ResultsView';
import './App.css';

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

  // API Config State - Google AI Studio API Key for local dev overrides
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

  // Field touched states for validation display
  const [touched, setTouched] = useState({
    dayDescription: false,
    peopleCount: false,
    budget: false
  });

  // References for accessibility focus management
  const stepHeadingRef = useRef(null);

  // Save API key in session storage when changed
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

  // Validation Logic
  const validationErrors = useMemo(() => {
    const errors = {};
    if (dayDescription.trim().length < 20) {
      errors.dayDescription = 'Describe your day in at least 20 characters.';
    }
    const count = parseInt(peopleCount, 10);
    if (isNaN(count) || count < 1 || count > 20) {
      errors.peopleCount = 'Cooking count must be between 1 and 20 people.';
    }
    const budgetNum = parseFloat(budget);
    if (isNaN(budgetNum) || budgetNum <= 0) {
      errors.budget = 'Please enter a valid daily budget greater than 0.';
    }
    return errors;
  }, [dayDescription, peopleCount, budget]);

  // Validation state checks
  const isStep1Valid = !validationErrors.dayDescription && !validationErrors.peopleCount;
  const isStep2Valid = isStep1Valid && !validationErrors.budget;

  // Wizard navigation handlers
  const handleNext = () => {
    // Show validation errors for step 1 fields if empty/invalid
    setTouched({
      dayDescription: true,
      peopleCount: true,
      budget: touched.budget
    });

    if (isStep1Valid) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const toggleDietary = (option) => {
    setDietaryRestrictions(prev =>
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };

  // Trigger meal generation
  const handleGenerate = async () => {
    setTouched({
      dayDescription: true,
      peopleCount: true,
      budget: true
    });

    if (!isStep2Valid) {
      return;
    }

    setStatus('loading');
    setCurrentStep(3);
    setExpandedMeal(null);

    // If Demo Mode, directly use the offline mock generator
    if (isDemoMode) {
      runLocalMockFallback();
      return;
    }

    // Otherwise (Live API Mode), fetch the server endpoint to run Gemini
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dayDescription,
          peopleCount,
          skillLevel,
          budget,
          currency,
          dietaryRestrictions,
          ownedIngredients,
          provider: 'gemini',
          googleApiKey: googleApiKey || undefined
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMessage = errJson.error || `Server returned status ${response.status}`;
        throw new Error(errMessage);
      }

      const parsedData = await response.json();
      
      const required = ['breakfast', 'lunch', 'dinner', 'grocery_list', 'substitutions', 'budget_summary'];
      const missing = required.filter(key => !parsedData.hasOwnProperty(key));
      if (missing.length > 0) {
        throw new Error(`Invalid schema structure from API. Missing keys: ${missing.join(', ')}`);
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
      setErrorMsg(err.message || 'An error occurred while connecting to the proxy API.');
      setStatus('error');
    }
  };

  const runLocalMockFallback = () => {
    setTimeout(() => {
      try {
        const mockPlan = generateMockMealPlan({
          dayDescription: sanitizeInput(dayDescription),
          peopleCount,
          skillLevel,
          budget,
          currency,
          dietaryRestrictions,
          ownedIngredients: sanitizeInput(ownedIngredients)
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
    }, 1200);
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
    setTouched({
      dayDescription: false,
      peopleCount: false,
      budget: false
    });
  };

  return (
    <main className="app-container">
      <div className="card">
        {/* Header Section (Always Visible) */}
        <header className="header-section">
          <div className="header-top">
            <div className="logo-title">
              <svg className="logo-icon" viewBox="0 0 24 24" aria-hidden="true" width="28" height="28">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.39.04-.08.08-.17.11-.27.42-1.28.79-2.58 1.15-3.89.07-.25-.01-.52-.2-.7L8.23 15.1c-.26-.26-.26-.69 0-.95l3.22-3.22c.26-.26.69-.26.95 0l1.67 1.67c.18.18.45.27.7.2.98-.27 1.95-.57 2.91-.9 0-.15-.02-.3-.06-.44-.42-1.28-.79-2.58-1.15-3.89-.07-.25.01-.52.2-.7l1.67-1.67c.26-.26.69-.26.95 0l1.1 1.1c.14.14.33.22.53.22.42 0 .82-.17 1.11-.47L22 4.41c-.42-.81-1.01-1.5-1.72-2.05L18.66 4c-.26.26-.69.26-.95 0l-1.1-1.1c-.26-.26-.26-.69 0-.95l1.67-1.67c.07-.07.12-.16.14-.26C16.29 2.02 14.18 2 12 2zm1 8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
              </svg>
              <span>Curated Meal Planner</span>
            </div>

            {/* API Mode Toggle - Hidden in Step 3 to reduce clutter */}
            {currentStep <= 2 && (
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
                    onChange={() => setIsDemoMode(!isDemoMode)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            )}
          </div>

          {/* Guided Flow Progress Steps (Always visible) */}
          <ProgressTracker currentStep={currentStep} />
        </header>

        {/* Dynamic Wizard Steps Rendering */}
        <div className="content-body">
          {currentStep === 1 && (
            <Step1
              dayDescription={dayDescription}
              setDayDescription={setDayDescription}
              peopleCount={peopleCount}
              setPeopleCount={setPeopleCount}
              skillLevel={skillLevel}
              setSkillLevel={setSkillLevel}
              validationErrors={validationErrors}
              touched={touched}
              setTouched={setTouched}
            />
          )}

          {currentStep === 2 && (
            <Step2
              budget={budget}
              setBudget={setBudget}
              currency={currency}
              setCurrency={setCurrency}
              dietaryRestrictions={dietaryRestrictions}
              toggleDietary={toggleDietary}
              ownedIngredients={ownedIngredients}
              setOwnedIngredients={setOwnedIngredients}
              validationErrors={validationErrors}
              touched={touched}
              setTouched={setTouched}
              isDemoMode={isDemoMode}
              focusedChipIndex={focusedChipIndex}
              setFocusedChipIndex={setFocusedChipIndex}
            />
          )}

          {currentStep === 3 && (
            <ResultsView
              status={status}
              errorMsg={errorMsg}
              results={results}
              peopleCount={peopleCount}
              currency={currency}
              budget={budget}
              copied={copied}
              expandedMeal={expandedMeal}
              setExpandedMeal={setExpandedMeal}
              handleCopyToClipboard={handleCopyToClipboard}
              handleGenerate={handleGenerate}
              handleReset={handleReset}
              stepHeadingRef={stepHeadingRef}
            />
          )}
        </div>

        {/* Action Button Footer Bar for Step 1 & 2 */}
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
                aria-label="Proceed to step 2"
              >
                Next
              </button>
            ) : (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleGenerate}
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
