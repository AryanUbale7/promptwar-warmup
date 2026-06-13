import React, { useRef, useEffect } from 'react';
import { DIETARY_OPTIONS } from '../utils';

const GRAY_500 = '#6B7280';

export default function Step2({
  budget,
  setBudget,
  currency,
  setCurrency,
  dietaryRestrictions,
  toggleDietary,
  ownedIngredients,
  setOwnedIngredients,
  validationErrors,
  touched,
  setTouched,
  isDemoMode,
  focusedChipIndex,
  setFocusedChipIndex
}) {
  const chipRefs = useRef([]);
  const showBudgetError = touched.budget && validationErrors.budget;

  useEffect(() => {
    chipRefs.current = chipRefs.current.slice(0, DIETARY_OPTIONS.length);
  }, []);

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

  return (
    <section aria-labelledby="step-2-title">
      <h2 
        id="step-2-title" 
        className="step-title" 
        tabIndex="-1" 
      >
        Step 2: Budget & Preferences
      </h2>

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
              onChange={(e) => {
                setBudget(e.target.value);
                setTouched(prev => ({ ...prev, budget: true }));
              }}
              onBlur={() => setTouched(prev => ({ ...prev, budget: true }))}
              aria-describedby={showBudgetError ? "budget-error" : undefined}
              required
            />
          </div>
          {showBudgetError && (
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
  );
}
