import React from 'react';
import MealCard from './MealCard';
import { getFeasibilityColor } from '../utils';

const GRAY_500 = '#6B7280';
const GRAY_700 = '#374151';
const GRAY_800 = '#1F2937';
const PRIMARY_TEAL_DARK = '#0F766E';

export default function ResultsView({
  status,
  errorMsg,
  results,
  peopleCount,
  currency,
  budget,
  copied,
  expandedMeal,
  setExpandedMeal,
  handleCopyToClipboard,
  handleGenerate,
  handleReset,
  stepHeadingRef
}) {
  return (
    <div aria-live="polite" aria-busy={status === 'loading'}>
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
          <svg className="error-icon" viewBox="0 0 24 24" aria-hidden="true" width="48" height="48">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h-2v2H7v-6h10v6zm0-8h-2V7h2v2z" />
          </svg>
          <h3 className="error-title">Generation Failed</h3>
          <p className="error-desc">{errorMsg}</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', justifyContent: 'center' }}>
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
          <svg className="empty-icon" viewBox="0 0 24 24" aria-hidden="true" width="64" height="64">
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
            <MealCard
              type="Breakfast"
              meal={results.breakfast}
              isExpanded={expandedMeal === 'breakfast'}
              onToggle={() => setExpandedMeal(expandedMeal === 'breakfast' ? null : 'breakfast')}
            />
            <MealCard
              type="Lunch"
              meal={results.lunch}
              isExpanded={expandedMeal === 'lunch'}
              onToggle={() => setExpandedMeal(expandedMeal === 'lunch' ? null : 'lunch')}
            />
            <MealCard
              type="Dinner"
              meal={results.dinner}
              isExpanded={expandedMeal === 'dinner'}
              onToggle={() => setExpandedMeal(expandedMeal === 'dinner' ? null : 'dinner')}
            />
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
  );
}
